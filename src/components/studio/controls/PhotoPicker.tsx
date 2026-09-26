"use client";

import { getFullUrl } from "@/lib/photo/assetStore";
import type { PhotoAsset } from "@/types/photo";

/**
 * A grid of the album, one photo selectable at a time.
 *
 * Used wherever a page has a photo the customer can change: the cover, the
 * title page, a slot on a photo page. The `selectedId` is the photo currently
 * in that spot, so the grid always shows which one they are replacing.
 */
export function PhotoPicker({
  photos,
  selectedId,
  onPick,
  badge,
  emptyLabel = "Add more photos to choose from.",
}: {
  photos: PhotoAsset[];
  selectedId: string | null;
  onPick: (photoId: string) => void;
  /** Short word shown on the current photo, e.g. "Cover" or "In use". */
  badge?: string;
  emptyLabel?: string;
}) {
  if (photos.length === 0) {
    return <p className="text-xs text-page-ink-faint">{emptyLabel}</p>;
  }

  return (
    <ol className="grid grid-cols-[repeat(auto-fill,minmax(80px,1fr))] gap-2">
      {photos.map((photo) => {
        const active = selectedId === photo.id;
        const url = getFullUrl(photo.id) ?? photo.thumbUrl;
        return (
          <li key={photo.id} className="relative">
            <button
              type="button"
              onClick={() => onPick(photo.id)}
              aria-pressed={active}
              className={`block w-full overflow-hidden rounded-md ring-1 transition-all ${
                active
                  ? "ring-2 ring-periwinkle"
                  : "ring-page-ink/10 hover:ring-periwinkle/60"
              }`}
            >
              <span className="block aspect-square">
                {/* eslint-disable-next-line @next/next/no-img-element -- local object URL */}
                <img
                  src={url}
                  alt=""
                  loading="lazy"
                  className="h-full w-full object-cover"
                />
              </span>
            </button>
            {active && badge ? (
              <span className="pointer-events-none absolute left-1 top-1 rounded bg-page-ink/75 px-1 py-0.5 text-[9px] uppercase tracking-wide text-white">
                {badge}
              </span>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
