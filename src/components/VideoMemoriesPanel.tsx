"use client";

import { useRef, useState } from "react";

import { ConfirmDialog } from "@/components/video/ConfirmDialog";
import {
  pageNumbersForAsset,
  placementsForAsset,
} from "@/lib/video-memory/count";
import {
  ZERO_STATE_BODY,
  ZERO_STATE_HEADING,
  ZERO_STATE_OFFER,
  packBoundaryCopy,
} from "@/lib/video-memory/pack-meter";
import { useVideoMemories } from "@/lib/video-memory/useVideoMemories";
import { statusLabel } from "@/lib/video-memory/status";
import type { BookPage } from "@/types/book";
import type { VideoAsset } from "@/types/video-memory";

/**
 * Every Video Memory in the book, and which page each code is printed on.
 *
 * The whole-book view, shown at the finishing step where the packs are being
 * paid for. Placing one page at a time is the Videos tab in the page
 * inspector; both run off `useVideoMemories`, so they are the same library.
 */
export function VideoMemoriesPanel({ pages }: { pages: BookPage[] }) {
  const videos = useVideoMemories();
  const [pendingPackAssetId, setPendingPackAssetId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<VideoAsset | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const { assets, placements, busy, meter, notice } = videos;
  const storyPages = pages.filter((page) => page.kind !== "imprint");

  const placeAsset = async (assetId: string, confirmedPack = false): Promise<void> => {
    if (!confirmedPack && videos.opensNewPack(assetId)) {
      setPendingPackAssetId(assetId);
      return;
    }
    const page = defaultPageForAsset(assetId, storyPages, placements);
    if (!page) {
      videos.setNotice("Add pages to your book before placing a Video Memory.");
      return;
    }
    await videos.place(assetId, page.id);
    setPendingPackAssetId(null);
  };

  // What the next pack would cost on top of what is already bought. Nothing
  // placed means no pack yet, and the offer is for the first one — this used
  // to say ten, so an empty library was told it had filled a pack it had
  // never bought.
  const boughtCapacity = meter.kind === "active" ? meter.capacity : 0;
  const packCopy = packBoundaryCopy(boughtCapacity);

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
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (file) void videos.upload(file);
            }}
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

      {notice ? (
        <p role="alert" className="mt-4 text-sm text-periwinkle-deep">
          {notice}
        </p>
      ) : null}

      {assets.length > 0 ? (
        <ul className="mt-5 divide-y divide-line">
          {assets.map((asset) => {
            const assetPlacements = placementsForAsset(placements, asset.id);
            const pageNumbers = pageNumbersForAsset(placements, pages, asset.id);
            return (
              <li key={asset.id} className="py-4 first:pt-0 last:pb-0">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <input
                      value={asset.title}
                      aria-label="Video Memory title"
                      onChange={(event) =>
                        videos.renameLocally(asset.id, event.target.value.slice(0, 80))
                      }
                      onBlur={(event) => videos.saveTitle(asset.id, event.target.value)}
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
                    {asset.status === "failed" ? (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void videos.retry(asset.id)}
                        className={secondaryButton}
                      >
                        Retry
                      </button>
                    ) : null}
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

                {assetPlacements.length > 0 ? (
                  <ul className="mt-3 space-y-2">
                    {assetPlacements.map((placement) => {
                      const page = pages.find((entry) => entry.id === placement.pageId);
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
                                void videos.movePlacement(placement.id, event.target.value)
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
                            onClick={() => void videos.removePlacement(placement.id)}
                            className={linkButton}
                          >
                            Remove from this page
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : null}

      {pendingPackAssetId ? (
        <ConfirmDialog
          title={packCopy.title}
          body={packCopy.body}
          confirm={packCopy.confirm}
          onCancel={() => setPendingPackAssetId(null)}
          onConfirm={() => void placeAsset(pendingPackAssetId, true)}
        />
      ) : null}

      {deleteTarget ? (
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
            void videos.removeAsset(assetId);
          }}
        />
      ) : null}
    </section>
  );
}

const secondaryButton =
  "rounded-xl border border-line px-3 py-2 text-sm font-medium text-ink transition-colors hover:border-periwinkle hover:text-periwinkle-deep disabled:cursor-not-allowed disabled:opacity-50";
const dangerButton =
  "rounded-xl border border-line px-3 py-2 text-sm font-medium text-ink-soft transition-colors hover:border-periwinkle-deep hover:text-periwinkle-deep disabled:cursor-not-allowed disabled:opacity-50";
const linkButton =
  "text-sm font-medium text-periwinkle underline decoration-line underline-offset-4 hover:text-periwinkle-deep disabled:opacity-50";

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
