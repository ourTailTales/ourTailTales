"use client";

import { Trash2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { useDialogA11y } from "@/lib/a11y/useDialog";
import type { AlbumVideoPreview } from "@/store/useOurTailTalesStore";
import type { PhotoAsset } from "@/types/photo";

/**
 * Everything dropped in so far, in one grid, each with its own way out.
 *
 * The album lives entirely on this device until the book is built, so
 * "delete" here really is delete — there is no server copy to fall back on.
 * That is also why this needs to exist at all: once media is folded into a
 * running total instead of a pile you can see, the only way to fix a bad
 * photo that snuck in is to start the whole album over.
 *
 * Portaled to `document.body` rather than rendered in place. The folder
 * button that opens this lives inside the upload step's own entrance
 * animation, which animates `transform` — and for as long as an ancestor is
 * doing that, it is the containing block for anything `fixed` inside it, so
 * without the portal this would cover that one component's box instead of
 * the screen.
 */
/** Thumbnails drawn at once. Enough to browse, far short of a camera roll. */
const PAGE = 120;

export function MediaLibraryModal({
  photos,
  videos,
  onRemovePhoto,
  onRemoveVideo,
  onClose,
}: {
  photos: PhotoAsset[];
  videos: AlbumVideoPreview[];
  onRemovePhoto: (id: string) => void;
  onRemoveVideo: (id: string) => void;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  useDialogA11y(dialogRef, { onClose });

  const [limit, setLimit] = useState(PAGE);
  const shown = photos.slice(0, limit);
  const hidden = photos.length - shown.length;

  const total = photos.length + videos.length;
  // Deleting the last thing in here leaves nothing to look at — close on its
  // own rather than sit open on an empty grid.
  useEffect(() => {
    if (total === 0) onClose();
  }, [total, onClose]);

  return createPortal(
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="mediaLibraryTitle"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      <div
        aria-hidden="true"
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-page-ink/40 backdrop-blur-sm"
      />

      <div className="relative flex max-h-[85dvh] w-full max-w-2xl flex-col rounded-2xl border border-page-line bg-white shadow-lift">
        <div className="flex items-center justify-between border-b border-page-line px-5 py-4">
          <h2 id="mediaLibraryTitle" className="font-display text-lg text-page-ink">
            {total} {total === 1 ? "item" : "items"} uploaded
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="inline-flex size-9 items-center justify-center rounded-full text-page-ink-faint transition-colors hover:bg-page-line/60 hover:text-page-ink"
          >
            <X aria-hidden className="size-4" />
          </button>
        </div>

        <div className="overflow-y-auto p-5">
          <ol className="grid grid-cols-3 gap-3 sm:grid-cols-4">
            {shown.map((photo) => (
              <li key={photo.id} className="relative">
                <span className="block aspect-square overflow-hidden rounded-lg bg-page-line/40">
                  <MediaThumb src={photo.thumbUrl} />
                </span>
                <button
                  type="button"
                  onClick={() => onRemovePhoto(photo.id)}
                  aria-label="Remove this photo"
                  className="absolute right-1 top-1 inline-flex size-7 items-center justify-center rounded-full bg-page-ink/70 text-white transition-colors hover:bg-red-600"
                >
                  <Trash2 aria-hidden className="size-3.5" />
                </button>
              </li>
            ))}
            {videos.map((video) => (
              <li key={video.id} className="relative">
                <span className="relative block aspect-square overflow-hidden rounded-lg bg-page-line/40">
                  <MediaThumb src={video.posterUrl} />
                  <span className="pointer-events-none absolute inset-x-0 bottom-0 truncate bg-page-ink/60 px-1.5 py-1 text-[10px] text-white">
                    {video.fileName}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => onRemoveVideo(video.id)}
                  aria-label="Remove this video"
                  className="absolute right-1 top-1 inline-flex size-7 items-center justify-center rounded-full bg-page-ink/70 text-white transition-colors hover:bg-red-600"
                >
                  <Trash2 aria-hidden className="size-3.5" />
                </button>
              </li>
            ))}
          </ol>

          {/* A camera roll is four thousand pictures, and every one of them as
              an <img> is four thousand decodes for a grid nobody scrolls to
              the end of. The rest are still in the book; this is the window
              onto them. */}
          {hidden > 0 ? (
            <div className="mt-5 flex flex-col items-center gap-2">
              <p className="text-sm text-ink-soft">
                Showing {shown.length.toLocaleString()} of {total.toLocaleString()}.
              </p>
              <button
                type="button"
                onClick={() => setLimit((current) => current + PAGE)}
                className="min-h-11 rounded-xl border border-line px-4 text-sm font-medium text-ink transition-colors hover:border-periwinkle hover:text-periwinkle-deep"
              >
                Show {Math.min(hidden, PAGE).toLocaleString()} more
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </div>,
    document.body,
  );
}

/**
 * A thumbnail that shows a spinner over itself until its own image has
 * decoded, instead of the modal waiting on every image before it appears.
 *
 * These are the small, already-generated browsing thumbnails, not the
 * full-resolution originals, so in practice each one settles almost as soon
 * as the modal is open — the spinner is mostly insurance for a slow device
 * or a very large album, not something to be seen for long.
 */
function MediaThumb({ src, alt = "" }: { src: string; alt?: string }) {
  const [loaded, setLoaded] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  // The browser's own cache can mark this `src` complete before React ever
  // attaches the `onLoad` handler below — reusing a thumbnail already shown
  // elsewhere on the page, say. Without this check that thumbnail would sit
  // behind its spinner forever, since the load event that would have cleared
  // it already came and went.
  useEffect(() => {
    setLoaded(Boolean(imgRef.current?.complete));
  }, [src]);

  return (
    <span className="relative block h-full w-full">
      {loaded ? null : (
        <span className="absolute inset-0 flex items-center justify-center">
          <span
            aria-hidden
            className="size-5 animate-spin rounded-full border-2 border-page-ink/15 border-t-page-ink/50"
          />
        </span>
      )}
      {/* eslint-disable-next-line @next/next/no-img-element -- local object URL */}
      <img
        ref={imgRef}
        src={src}
        alt={alt}
        loading="lazy"
        onLoad={() => setLoaded(true)}
        className={`h-full w-full object-cover transition-opacity duration-200 ${
          loaded ? "opacity-100" : "opacity-0"
        }`}
      />
    </span>
  );
}
