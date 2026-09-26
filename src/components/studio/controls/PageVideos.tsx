"use client";

import { Check, Film, Plus, Trash2 } from "lucide-react";
import { useRef, useState } from "react";

import { ConfirmDialog } from "@/components/video/ConfirmDialog";
import { placementsForAsset } from "@/lib/video-memory/count";
import {
  ZERO_STATE_BODY,
  ZERO_STATE_OFFER,
  packBoundaryCopy,
} from "@/lib/video-memory/pack-meter";
import { statusLabel } from "@/lib/video-memory/status";
import { useVideoMemories } from "@/lib/video-memory/useVideoMemories";

/**
 * The videos whose codes are printed on this page.
 *
 * Placing a video used to mean leaving the book, opening a panel that listed
 * every page as a dropdown, and choosing the number of the page you had been
 * looking at. Here the page is the one on screen, so placing is one tap on the
 * video you want, and a code on the page is a tile you can take straight back
 * off it.
 *
 * The library and the pack price are `useVideoMemories`, the same as the
 * whole-book panel at the finishing step: a video placed here is placed there.
 */
export function PageVideos({ pageId }: { pageId: string }) {
  const videos = useVideoMemories();
  const [pendingPackAssetId, setPendingPackAssetId] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const { assets, placements, busy, meter, notice } = videos;
  const onThisPage = placements.filter((placement) => placement.pageId === pageId);
  const placedHere = new Set(onThisPage.map((placement) => placement.videoAssetId));

  const place = async (assetId: string, confirmedPack = false): Promise<void> => {
    if (!confirmedPack && videos.opensNewPack(assetId)) {
      setPendingPackAssetId(assetId);
      return;
    }
    await videos.place(assetId, pageId);
    setPendingPackAssetId(null);
  };

  // Nothing placed means no pack bought yet, so the question is the offer of a
  // first one rather than the filling of a next one.
  const packCopy = packBoundaryCopy(meter.kind === "active" ? meter.capacity : 0);

  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs leading-5 text-page-ink-faint">
        {meter.kind === "empty" ? (
          <>
            {ZERO_STATE_BODY} {ZERO_STATE_OFFER}, paid for when you order the
            book.
          </>
        ) : (
          <>
            {meter.usedLabel}
            <span className="mx-1.5">·</span>
            <span className="font-medium text-page-ink">{meter.priceLabel}</span>
            <span className="mx-1.5">·</span>
            charged when you order the book
          </>
        )}
      </p>

      {notice ? (
        <p role="alert" className="text-xs leading-5 text-periwinkle-deep">
          {notice}
        </p>
      ) : null}

      {onThisPage.length > 0 ? (
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-page-ink-faint">
            {onThisPage.length === 1 ? "Code on this page" : "Codes on this page"}
          </h3>
          <ul className="mt-2 flex flex-col gap-2">
            {onThisPage.map((placement) => {
              const asset = assets.find((entry) => entry.id === placement.videoAssetId);
              return (
                <li
                  key={placement.id}
                  className="flex items-center gap-2 rounded-lg border border-page-line bg-white px-3 py-2"
                >
                  <Film aria-hidden className="size-4 shrink-0 text-periwinkle-deep" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-page-ink">
                      {asset?.title ?? "Video Memory"}
                    </span>
                    {asset && asset.status !== "ready" ? (
                      <span className="block text-[0.7rem] text-page-ink-faint">
                        {statusLabel(asset)}
                      </span>
                    ) : null}
                  </span>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void videos.removePlacement(placement.id)}
                    aria-label={`Take ${asset?.title ?? "this video"} off this page`}
                    className="inline-flex size-8 shrink-0 items-center justify-center rounded-full text-page-ink-faint transition-colors hover:bg-page-line/50 hover:text-page-ink disabled:opacity-50"
                  >
                    <Trash2 aria-hidden className="size-3.5" />
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      {assets.length > 0 ? (
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-page-ink-faint">
            Your videos
          </h3>
          <ul className="mt-2 grid grid-cols-[repeat(auto-fill,minmax(80px,1fr))] gap-2">
            {assets.map((asset) => {
              const here = placedHere.has(asset.id);
              const elsewhere = placementsForAsset(placements, asset.id).length - (here ? 1 : 0);
              return (
                <li key={asset.id}>
                  <button
                    type="button"
                    disabled={busy}
                    aria-pressed={here}
                    onClick={() => void place(asset.id)}
                    className={`relative block w-full overflow-hidden rounded-md border text-left transition-colors disabled:opacity-50 ${
                      here
                        ? "border-periwinkle ring-2 ring-periwinkle/30"
                        : "border-page-line hover:border-periwinkle"
                    }`}
                  >
                    <span className="flex aspect-square w-full items-center justify-center bg-memory-blue/40">
                      {asset.previewUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element -- signed storage URL
                        <img
                          src={asset.previewUrl}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <Film aria-hidden className="size-5 text-periwinkle-deep" />
                      )}
                    </span>
                    {here ? (
                      <span className="absolute right-1 top-1 flex size-5 items-center justify-center rounded-full bg-periwinkle text-white">
                        <Check aria-hidden className="size-3" strokeWidth={3} />
                      </span>
                    ) : null}
                    <span className="block border-t border-page-line bg-white px-1.5 py-1">
                      <span className="block truncate text-[0.7rem] leading-4 text-page-ink">
                        {asset.title}
                      </span>
                      <span className="block truncate text-[0.65rem] leading-4 text-page-ink-faint">
                        {asset.status === "ready"
                          ? here
                            ? "On this page"
                            : elsewhere > 0
                              ? `On ${elsewhere} other ${elsewhere === 1 ? "page" : "pages"}`
                              : "Tap to place"
                          : statusLabel(asset)}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

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
          className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-periwinkle px-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-periwinkle-deep disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Plus aria-hidden className="size-4" strokeWidth={2.5} />
          {busy ? "Working…" : "Add a video"}
        </button>
      </div>

      {pendingPackAssetId ? (
        <ConfirmDialog
          title={packCopy.title}
          body={packCopy.body}
          confirm={packCopy.confirm}
          onCancel={() => setPendingPackAssetId(null)}
          onConfirm={() => void place(pendingPackAssetId, true)}
        />
      ) : null}
    </div>
  );
}
