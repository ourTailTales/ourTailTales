"use client";

import { Check } from "lucide-react";
import { useMemo } from "react";

import { PageCanvas } from "@/components/book-viewer/PageCanvas";
import { DESIGNS, resolveDesign, withDesign } from "@/lib/book/design";
import { track } from "@/lib/analytics";
import { useOurTailTalesStore } from "@/store/useOurTailTalesStore";
import type { BookMeta, BookPage, Chapter } from "@/types/book";
import type { PhotoAsset } from "@/types/photo";

/**
 * The book's design, one tap to change.
 *
 * Each option is the page the customer is looking at, drawn in that design —
 * their own photos and words, not a stock sample — so the choice is between
 * four versions of their book rather than four abstract styles. Switching
 * never moves a photo: every design lays out the same pages with the same
 * photos on them.
 */
export function DesignPicker({
  page,
  meta,
  chapters,
  photos,
}: {
  /** The page to show each design with; falls back to a photo page. */
  page: BookPage | null;
  meta: BookMeta;
  chapters: Chapter[];
  photos: Map<string, PhotoAsset>;
}) {
  const setMeta = useOurTailTalesStore((state) => state.setMeta);
  const pages = useOurTailTalesStore((state) => state.pages);
  const current = resolveDesign(meta).id;

  // The cover is not drawn by a design, so it shows nothing to compare; nor
  // does a page with no photos yet.
  const sample = useMemo(() => {
    if (page && page.photoIds.length > 0) return page;
    return (
      pages.find((entry) => entry.kind === "photos" && entry.photoIds.length >= 2) ??
      pages.find((entry) => entry.photoIds.length > 0) ??
      null
    );
  }, [page, pages]);

  return (
    <div>
      <h2 className="font-display text-lg text-page-ink">Book design</h2>
      <p className="mt-1 text-xs leading-5 text-page-ink-faint">
        Restyles every page at once. Your photos stay on the pages they are on.
      </p>
      <div
        role="radiogroup"
        aria-label="Book design"
        className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4"
      >
        {DESIGNS.map((design) => {
          const active = design.id === current;
          return (
            <button
              key={design.id}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => {
                if (active) return;
                setMeta({ designId: design.id });
                track("book_design_changed", { design: design.id });
              }}
              className={`group flex flex-col overflow-hidden rounded-xl border text-left transition-colors ${
                active
                  ? "border-periwinkle ring-2 ring-periwinkle/30"
                  : "border-page-line hover:border-periwinkle"
              }`}
            >
              <span className="relative block">
                {sample ? (
                  <PageCanvas
                    page={sample}
                    meta={withDesign(meta, design.id)}
                    chapters={chapters}
                    photos={photos}
                  />
                ) : (
                  <span className="block aspect-square bg-memory-blue/40" />
                )}
                {active ? (
                  <span className="absolute right-1.5 top-1.5 flex size-6 items-center justify-center rounded-full bg-periwinkle text-white shadow-sm">
                    <Check aria-hidden className="size-3.5" strokeWidth={3} />
                  </span>
                ) : null}
              </span>
              <span className="block border-t border-page-line bg-white px-2.5 py-2">
                <span className="block text-sm font-medium text-page-ink">{design.name}</span>
                <span className="block text-[0.7rem] leading-4 text-page-ink-soft">
                  {design.tagline}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
