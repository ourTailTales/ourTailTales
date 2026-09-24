"use client";

import { X } from "lucide-react";
import { useRef } from "react";

import { CoverCanvas, PageCanvas } from "@/components/book-viewer/PageCanvas";
import { useDialogA11y } from "@/lib/a11y/useDialog";
import type { BookMeta, BookPage, Chapter } from "@/types/book";
import type { PhotoAsset } from "@/types/photo";

/**
 * The page, as large as the screen allows, pinch-zoomable from there.
 *
 * `PageCanvas` sizes its type in `cqw` so the same markup is correct at every
 * container width, and the studio's own viewport is that container sized down
 * to fit next to the filmstrip and the tools. On a phone that container is
 * roughly a third of a printed page, and the ten-and-a-half point body text
 * this book is actually set in comes out somewhere around six pixels: legible
 * to nobody. Full-bleed edge to edge does not fix that on its own — a phone
 * screen is still a phone screen — so this opens the same page at the largest
 * square the viewport has room for and leaves native pinch-zoom switched on,
 * which is the one way to actually read a set page at whatever size a given
 * pair of eyes needs, the way opening a photo full-screen already works
 * everywhere else.
 */
export function PageZoom({
  page,
  label,
  meta,
  chapters,
  photos,
  photoList,
  onClose,
}: {
  /** Null for the cover. */
  page: BookPage | null;
  label: string;
  meta: BookMeta;
  chapters: Chapter[];
  photos: Map<string, PhotoAsset>;
  photoList: PhotoAsset[];
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  useDialogA11y(dialogRef, { onClose, initialFocusRef: closeRef });

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label={`${label}, full size`}
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/92 p-4 backdrop-blur-sm"
    >
      {/* Pointer-only dismissal. The X below and Escape cover keyboard and
          screen-reader users, so this carries no competing "Close" name. */}
      <div aria-hidden="true" onClick={onClose} className="absolute inset-0 cursor-default" />

      <button
        ref={closeRef}
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="absolute right-4 top-4 z-10 flex size-11 items-center justify-center rounded-full bg-white/95 text-page-ink shadow-lift transition-colors hover:text-periwinkle-deep"
      >
        <X aria-hidden className="size-5" strokeWidth={2.25} />
      </button>

      {/*
        Pinch-to-zoom is native browser behaviour and works here precisely
        because nothing on this element restricts touch-action or calls
        preventDefault on a touch event — the one thing this component has to
        get right is staying out of the way.
      */}
      <div
        className="relative max-h-full max-w-full overflow-hidden rounded-xl bg-white shadow-2xl"
        style={{ width: "min(calc(100dvw - 2rem), calc(100dvh - 2rem))" }}
      >
        {page ? (
          <PageCanvas page={page} meta={meta} chapters={chapters} photos={photos} />
        ) : (
          <CoverCanvas meta={meta} photos={photoList} />
        )}
      </div>
    </div>
  );
}
