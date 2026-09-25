"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  includedUniqueVideoCount,
  pageNumbersForAsset,
  placementsForAsset,
} from "@/lib/video-memory/count";
import {
  DURATION_TOO_LONG_MESSAGE,
  STORAGE_UNAVAILABLE_MESSAGE,
  sourceTooLargeMessage,
} from "@/lib/video-memory/config";
import { isAcceptableVideoDuration } from "@/lib/video-memory/duration";
import { wouldOpenNewPack } from "@/lib/video-memory/pricing";
import {
  ZERO_STATE_BODY,
  ZERO_STATE_HEADING,
  ZERO_STATE_OFFER,
  packBoundaryCopy,
  packMeterView,
} from "@/lib/video-memory/pack-meter";
import {
  deleteVideoMemory,
  ensureDraft,
  fetchVideoLibrary,
  fetchVideoMemoryConfig,
  placeVideoMemory,
  readVideoDurationMs,
  removePlacementFromPage,
  renameVideoMemory,
  retryVideoMemory,
  type StoredDraft,
  type VideoMemoryPublicConfig,
  updatePlacementPage,
  uploadVideoMemory,
} from "@/lib/video-memory/client";
import { useOurTailTalesStore } from "@/store/useOurTailTalesStore";
import type { BookPage } from "@/types/book";
import type { VideoAsset } from "@/types/video-memory";

export function VideoMemoriesPanel({ pages }: { pages: BookPage[] }) {
  const draftId = useOurTailTalesStore((state) => state.draftId);
  const draftSecret = useOurTailTalesStore((state) => state.draftSecret);
  const assets = useOurTailTalesStore((state) => state.videoAssets);
  const placements = useOurTailTalesStore((state) => state.placements);
  const notice = useOurTailTalesStore((state) => state.videoNotice);
  const setDraft = useOurTailTalesStore((state) => state.setDraft);
  const setVideoLibrary = useOurTailTalesStore((state) => state.setVideoLibrary);
  const setVideoNotice = useOurTailTalesStore((state) => state.setVideoNotice);

  const [config, setConfig] = useState<VideoMemoryPublicConfig | null>(null);
  const [busy, setBusy] = useState(false);
  const [pendingPackAssetId, setPendingPackAssetId] = useState<string | null>(
    null,
  );
  const [deleteTarget, setDeleteTarget] = useState<VideoAsset | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const draft = useMemo<StoredDraft | null>(
    () => (draftId && draftSecret ? { draftId, secret: draftSecret } : null),
    [draftId, draftSecret],
  );

  const refresh = useCallback(
    async (nextDraft?: StoredDraft) => {
      const active = nextDraft ?? draft;
      if (!active) return;
      const library = await fetchVideoLibrary(active);
      setVideoLibrary(library.assets, library.placements);
    },
    [draft, setVideoLibrary],
  );

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        // The draft the book is already banked against comes first. Asking for
        // one unconditionally means a browser whose local copy has been
        // cleared gets a brand new draft here, and the book's own id is then
        // replaced by one with no PDF behind it — no clean copy to sell, and
        // an order pointing at nothing. Only a book that has no draft at all
        // needs one made.
        const held = useOurTailTalesStore.getState();
        const [nextDraft, nextConfig] = await Promise.all([
          held.draftId && held.draftSecret
            ? Promise.resolve({ draftId: held.draftId, secret: held.draftSecret })
            : ensureDraft(held.leadEmail),
          fetchVideoMemoryConfig(),
        ]);
        if (cancelled) return;
        setDraft(nextDraft.draftId, nextDraft.secret);
        setConfig(nextConfig);
        const library = await fetchVideoLibrary(nextDraft);
        if (!cancelled) {
          setVideoLibrary(library.assets, library.placements);
        }
      } catch (error) {
        if (!cancelled) {
          setVideoNotice(
            error instanceof Error ? error.message : STORAGE_UNAVAILABLE_MESSAGE,
          );
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [setDraft, setVideoLibrary, setVideoNotice]);

  const needsPoll = assets.some(
    (asset) => asset.status === "uploaded" || asset.status === "processing",
  );

  useEffect(() => {
    if (!draft || !needsPoll) return;
    const timer = window.setInterval(() => {
      void refresh().catch(() => {
        // Keep the last known library; the next tick retries.
      });
    }, 4000);
    return () => window.clearInterval(timer);
  }, [draft, needsPoll, refresh]);

  const uniquePlaced = includedUniqueVideoCount(placements);
  const meter = packMeterView(uniquePlaced);
  const storyPages = useMemo(
    () => pages.filter((page) => page.kind !== "imprint"),
    [pages],
  );

  const run = async (work: (active: StoredDraft) => Promise<void>) => {
    if (!draft || busy) return;
    setBusy(true);
    setVideoNotice(null);
    try {
      await work(draft);
      await refresh();
    } catch (error) {
      setVideoNotice(
        error instanceof Error ? error.message : STORAGE_UNAVAILABLE_MESSAGE,
      );
    } finally {
      setBusy(false);
    }
  };

  const placeAsset = async (assetId: string, confirmedPack = false) => {
    const alreadyIncluded = placements.some(
      (placement) => placement.videoAssetId === assetId,
    );
    if (!confirmedPack && wouldOpenNewPack(uniquePlaced, !alreadyIncluded)) {
      setPendingPackAssetId(assetId);
      return;
    }
    const page = defaultPageForAsset(assetId, storyPages, placements);
    if (!page) {
      setVideoNotice("Add pages to your book before placing a Video Memory.");
      return;
    }
    await run(async (active) => {
      await placeVideoMemory(active, assetId, page.id);
    });
    setPendingPackAssetId(null);
  };

  const onFiles = async (files: FileList | null) => {
    const file = files?.[0];
    if (fileInput.current) fileInput.current.value = "";
    if (!file || !draft) return;

    const maxBytes = config?.maxSourceBytes;
    if (maxBytes && file.size > maxBytes) {
      setVideoNotice(sourceTooLargeMessage(maxBytes));
      return;
    }

    setBusy(true);
    setVideoNotice(null);
    try {
      const durationMs = await readVideoDurationMs(file);
      if (
        !isAcceptableVideoDuration(durationMs) ||
        (config && durationMs > config.maxDurationMs)
      ) {
        setVideoNotice(config?.durationTooLongMessage ?? DURATION_TOO_LONG_MESSAGE);
        return;
      }
      await uploadVideoMemory(draft, file, {
        durationMs,
        title: file.name.replace(/\.[^.]+$/, "").slice(0, 60),
      });
      await refresh();
    } catch (error) {
      setVideoNotice(
        error instanceof Error ? error.message : STORAGE_UNAVAILABLE_MESSAGE,
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="rounded-2xl border border-line bg-white p-5 shadow-lift sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="font-display text-xl text-ink">{ZERO_STATE_HEADING}</h2>
          {meter.kind === "empty" ? (
            <>
              <p className="mt-1 text-sm font-medium text-ink">{ZERO_STATE_OFFER}</p>
              <p className="mt-1 text-sm text-ink-soft">{ZERO_STATE_BODY}</p>
            </>
          ) : (
            <p className="mt-1 text-sm text-ink-soft">
              {meter.usedLabel}
              <span className="mx-2 text-ink-faint">·</span>
              <span className="font-medium text-ink">{meter.priceLabel}</span>
            </p>
          )}
        </div>
        <div>
          <input
            ref={fileInput}
            type="file"
            accept="video/mp4,video/quicktime,video/webm,.mp4,.mov,.m4v,.webm"
            className="sr-only"
            onChange={(event) => void onFiles(event.target.files)}
          />
          <button
            type="button"
            disabled={busy}
            onClick={() => fileInput.current?.click()}
            className="rounded-xl bg-periwinkle px-4 py-2 text-sm font-semibold text-white shadow-lift transition-colors hover:bg-periwinkle-deep disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? "Working…" : "Add Video Memory"}
          </button>
        </div>
      </div>

      {notice && (
        <p role="alert" className="mt-4 text-sm text-periwinkle-deep">
          {notice}
        </p>
      )}

      {assets.length > 0 && (
        <ul className="mt-5 divide-y divide-line">
          {assets.map((asset) => {
            const assetPlacements = placementsForAsset(placements, asset.id);
            const pageNumbers = pageNumbersForAsset(
              placements,
              pages,
              asset.id,
            );
            return (
              <li key={asset.id} className="py-4 first:pt-0 last:pb-0">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <input
                      value={asset.title}
                      aria-label="Video Memory title"
                      onChange={(event) => {
                        const title = event.target.value.slice(0, 80);
                        setVideoLibrary(
                          assets.map((entry) =>
                            entry.id === asset.id ? { ...entry, title } : entry,
                          ),
                          placements,
                        );
                      }}
                      onBlur={(event) => {
                        if (!draft) return;
                        void renameVideoMemory(
                          draft,
                          asset.id,
                          event.target.value.trim() || "Video Memory",
                        ).catch((error: unknown) => {
                          setVideoNotice(
                            error instanceof Error
                              ? error.message
                              : STORAGE_UNAVAILABLE_MESSAGE,
                          );
                        });
                      }}
                      className="w-full max-w-sm border-0 bg-transparent p-0 font-medium text-ink outline-none focus:underline"
                    />
                    <p className="mt-1 text-sm text-ink-soft">
                      {statusLabel(asset)}
                      <span className="mx-2 text-ink-faint">·</span>
                      {pageNumbers.length > 0
                        ? `Placed on ${pageList(pageNumbers)}`
                        : "Not placed in book"}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {asset.status === "failed" && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() =>
                          void run((active) => retryVideoMemory(active, asset.id))
                        }
                        className={secondaryButton}
                      >
                        Retry
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={busy || storyPages.length === 0}
                      onClick={() => void placeAsset(asset.id)}
                      className={secondaryButton}
                    >
                      Place on a page
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => setDeleteTarget(asset)}
                      className={dangerButton}
                    >
                      Delete Video Memory
                    </button>
                  </div>
                </div>

                {assetPlacements.length > 0 && (
                  <ul className="mt-3 space-y-2">
                    {assetPlacements.map((placement) => {
                      const page = pages.find(
                        (entry) => entry.id === placement.pageId,
                      );
                      return (
                        <li
                          key={placement.id}
                          className="flex flex-wrap items-center gap-3 rounded-lg bg-cloud px-3 py-2 text-sm"
                        >
                          <label className="flex items-center gap-2 text-ink-soft">
                            Page
                            <select
                              value={placement.pageId}
                              disabled={busy}
                              onChange={(event) =>
                                void run((active) =>
                                  updatePlacementPage(
                                    active,
                                    placement.id,
                                    event.target.value,
                                  ),
                                )
                              }
                              className="rounded-md border border-line bg-white px-2 py-1 text-ink"
                            >
                              {storyPages.map((entry) => (
                                <option key={entry.id} value={entry.id}>
                                  {pageOptionLabel(entry)}
                                </option>
                              ))}
                            </select>
                          </label>
                          <span className="text-ink-faint">
                            {page ? pageOptionLabel(page) : placement.pageId}
                          </span>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() =>
                              void run((active) =>
                                removePlacementFromPage(active, placement.id),
                              )
                            }
                            className={linkButton}
                          >
                            Remove from this page
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {pendingPackAssetId && (
        <ConfirmDialog
          title={packBoundaryCopy(meter.kind === "active" ? meter.capacity : 10).title}
          body={packBoundaryCopy(meter.kind === "active" ? meter.capacity : 10).body}
          confirm={packBoundaryCopy(meter.kind === "active" ? meter.capacity : 10).confirm}
          onCancel={() => setPendingPackAssetId(null)}
          onConfirm={() => void placeAsset(pendingPackAssetId, true)}
        />
      )}

      {deleteTarget && (
        <ConfirmDialog
          title="Delete this Video Memory?"
          body={
            placementsForAsset(placements, deleteTarget.id).length > 1
              ? `This video appears on ${placementsForAsset(placements, deleteTarget.id).length} pages. Deleting it will remove all ${placementsForAsset(placements, deleteTarget.id).length} QR placements from your book.`
              : "This removes the video from your library and any QR placements in the book."
          }
          confirm="Delete Video Memory"
          danger
          onCancel={() => setDeleteTarget(null)}
          onConfirm={() => {
            const assetId = deleteTarget.id;
            setDeleteTarget(null);
            void run((active) => deleteVideoMemory(active, assetId));
          }}
        />
      )}
    </section>
  );
}

function ConfirmDialog({
  title,
  body,
  confirm,
  danger,
  onCancel,
  onConfirm,
}: {
  title: string;
  body: string;
  confirm: string;
  danger?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-5">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="video-memory-confirm-title"
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-lift"
      >
        <h3
          id="video-memory-confirm-title"
          className="font-display text-xl text-ink"
        >
          {title}
        </h3>
        <p className="mt-3 text-sm leading-6 text-ink-soft">{body}</p>
        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <button type="button" onClick={onCancel} className={linkButton}>
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={
              danger
                ? "rounded-xl bg-periwinkle-deep px-4 py-2 text-sm font-semibold text-white"
                : "rounded-xl bg-periwinkle px-4 py-2 text-sm font-semibold text-white"
            }
          >
            {confirm}
          </button>
        </div>
      </div>
    </div>
  );
}

function statusLabel(asset: VideoAsset): string {
  switch (asset.status) {
    case "uploaded":
      return "Uploading…";
    case "processing":
      return "Preparing video…";
    case "ready":
      return "Ready";
    case "failed":
      return "Processing failed";
  }
}

function pageList(pages: number[]): string {
  if (pages.length === 1) return `page ${pages[0]}`;
  if (pages.length === 2) return `pages ${pages[0]} and ${pages[1]}`;
  return `pages ${pages.slice(0, -1).join(", ")}, and ${pages.at(-1)}`;
}

function pageOptionLabel(page: BookPage): string {
  return `Page ${page.pageNumber}`;
}

function defaultPageForAsset(
  assetId: string,
  pages: BookPage[],
  placements: { videoAssetId: string; pageId: string }[],
): BookPage | undefined {
  const used = new Set(
    placements
      .filter((placement) => placement.videoAssetId === assetId)
      .map((placement) => placement.pageId),
  );
  return pages.find((page) => !used.has(page.id)) ?? pages[0];
}

const secondaryButton =
  "rounded-lg border border-line bg-white px-3 py-1.5 text-xs font-medium text-ink-soft transition-colors hover:border-periwinkle hover:text-periwinkle-deep disabled:opacity-40";

const dangerButton =
  "rounded-lg border border-line bg-white px-3 py-1.5 text-xs font-medium text-ink-soft transition-colors hover:border-periwinkle-deep hover:text-periwinkle-deep disabled:opacity-40";

const linkButton =
  "text-sm text-ink-soft underline decoration-line underline-offset-4 transition-colors hover:text-periwinkle-deep";
