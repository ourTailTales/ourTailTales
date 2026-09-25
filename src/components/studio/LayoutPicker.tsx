"use client";

import { Sparkles } from "lucide-react";
import { useMemo } from "react";

import { PageCanvas } from "@/components/book-viewer/PageCanvas";
import { PHOTO_LAYOUTS } from "@/lib/book/layouts";
import type { BookMeta, BookPage, PhotoLayoutId } from "@/types/book";

const NO_CHAPTERS: never[] = [];
const NO_PHOTOS = new Map();

/**
 * The ten page layouts, drawn in the book's own design.
 *
 * Each option is a real page from the design with placeholder photos, so what
 * is offered is exactly what the page becomes — tilted polaroids in the
 * scrapbook, a clean grid in Classic. A layout needing more photos than the
 * chapter has is shown but cannot be picked, with the reason on it.
 */
export function LayoutPicker({
  meta,
  current,
  chosen,
  maxPhotos,
  onPick,
}: {
  meta: BookMeta;
  /** The layout the page is in now. */
  current: PhotoLayoutId | null;
  /** True when the customer picked `current`, false when the book did. */
  chosen: boolean;
  /** The most photos this page could hold. */
  maxPhotos: number;
  onPick: (layoutId: PhotoLayoutId | null) => void;
}) {
  const previews = useMemo(
    () =>
      PHOTO_LAYOUTS.map((layout) => ({
        layout,
        page: {
          id: `layout-preview-${layout.id}`,
          kind: "photos",
          pageNumber: 0,
          layoutId: layout.id,
          photoIds: Array.from({ length: layout.photoCount }, (_, index) => `preview-${index}`),
        } satisfies BookPage,
      })),
    [],
  );

  return (
    <div>
      <div role="radiogroup" aria-label="Page layout" className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        <button
          type="button"
          role="radio"
          aria-checked={!chosen}
          onClick={() => onPick(null)}
          className={`flex aspect-square flex-col items-center justify-center gap-1.5 rounded-lg border p-2 text-center transition-colors ${
            !chosen
              ? "border-periwinkle bg-periwinkle-wash/50 ring-2 ring-periwinkle/30"
              : "border-page-line bg-white hover:border-periwinkle"
          }`}
        >
          <Sparkles aria-hidden className="size-5 text-periwinkle" />
          <span className="text-xs font-medium text-page-ink">Automatic</span>
          <span className="text-[0.65rem] leading-3 text-page-ink-faint">Best fit for these photos</span>
        </button>

        {previews.map(({ layout, page }) => {
          const active = chosen && current === layout.id;
          const tooMany = layout.photoCount > maxPhotos;
          return (
            <button
              key={layout.id}
              type="button"
              role="radio"
              aria-checked={active}
              disabled={tooMany}
              onClick={() => onPick(layout.id)}
              title={
                tooMany
                  ? `This chapter doesn't have ${layout.photoCount} photos to spare for one page.`
                  : layout.label
              }
              className={`group relative flex flex-col overflow-hidden rounded-lg border text-left transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                active
                  ? "border-periwinkle ring-2 ring-periwinkle/30"
                  : "border-page-line hover:border-periwinkle disabled:hover:border-page-line"
              }`}
            >
              <PageCanvas page={page} meta={meta} chapters={NO_CHAPTERS} photos={NO_PHOTOS} placeholder />
              <span className="flex items-baseline justify-between gap-1 border-t border-page-line bg-white px-1.5 py-1">
                <span className="truncate text-[0.68rem] font-medium text-page-ink">{layout.label}</span>
                <span className="shrink-0 text-[0.62rem] text-page-ink-faint">{layout.photoCount}</span>
              </span>
              {!chosen && current === layout.id ? (
                <span className="absolute left-1 top-1 rounded-full bg-white/90 px-1.5 py-0.5 text-[0.6rem] font-medium text-page-ink-soft shadow-sm">
                  In use
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
