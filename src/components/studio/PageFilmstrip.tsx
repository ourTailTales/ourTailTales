"use client";

import { Lock } from "lucide-react";
import { useEffect, useRef } from "react";

import { CoverCanvas, PageCanvas } from "@/components/book-viewer/PageCanvas";
import type { StudioSlide } from "@/lib/book/studio";
import type { BookMeta, Chapter } from "@/types/book";
import type { PhotoAsset } from "@/types/photo";

/**
 * How many thumbnails either side of the selection carry real photos.
 *
 * A fifty-chapter book is over five hundred pages; rendering every one of them
 * with its photographs would decode a couple of thousand images to fill a strip
 * nobody is looking at yet. Everything outside this window draws its layout
 * without the pictures, which is enough to show the shape of the page, and
 * fills in as the customer moves.
 */
const PHOTO_WINDOW = 12;

/**
 * The filmstrip: every page of the book, in order, along the bottom.
 *
 * Scrolling here browses; it never selects. Binding the viewport to scroll
 * position sounds seamless and is the opposite — the controls change under
 * someone's hand while they are still looking for a page, and they lose their
 * place. So the strip moves freely and a tap commits, which is also what makes
 * it usable with a trackpad, a finger, and the arrow keys alike.
 *
 * The selected thumbnail is scrolled into view when selection changes from
 * elsewhere (arrow keys, the wall's "keep reading"), but never while the
 * customer is the one doing the scrolling.
 */
export function PageFilmstrip({
  slides,
  selected,
  onSelect,
  meta,
  chapters,
  photos,
  photoList,
}: {
  slides: StudioSlide[];
  selected: number;
  onSelect: (position: number) => void;
  meta: BookMeta;
  chapters: Chapter[];
  photos: Map<string, PhotoAsset>;
  photoList: PhotoAsset[];
}) {
  const stripRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLButtonElement>(null);
  const userScrolling = useRef(false);

  useEffect(() => {
    if (userScrolling.current) return;
    activeRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
      inline: "center",
    });
  }, [selected]);

  return (
    <div className="border-t border-page-line bg-white/85 backdrop-blur">
      <div
        ref={stripRef}
        onPointerDown={() => {
          userScrolling.current = true;
        }}
        onPointerUp={() => {
          userScrolling.current = false;
        }}
        onWheel={() => {
          userScrolling.current = true;
          window.setTimeout(() => {
            userScrolling.current = false;
          }, 600);
        }}
        className="flex snap-x snap-proximity gap-3 overflow-x-auto px-4 py-3 sm:px-6"
        role="tablist"
        aria-label="Pages"
      >
        {slides.map((slide) => {
          const isActive = slide.position === selected;
          const nearby = Math.abs(slide.position - selected) <= PHOTO_WINDOW;
          return (
            <div key={slide.key} className="flex shrink-0 items-end gap-3">
              {slide.chapterStart && slide.position !== 0 ? (
                <span
                  aria-hidden
                  className="mb-8 h-14 w-px shrink-0 bg-page-line"
                />
              ) : null}

              <button
                ref={isActive ? activeRef : undefined}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => onSelect(slide.position)}
                className="group flex w-[4.5rem] shrink-0 snap-center flex-col items-center gap-1.5 sm:w-20"
              >
                <span
                  className={`relative block w-full overflow-hidden rounded-md border transition-all ${
                    isActive
                      ? "border-periwinkle ring-2 ring-periwinkle/35"
                      : "border-page-line group-hover:border-periwinkle/60"
                  }`}
                >
                  {slide.page ? (
                    <PageCanvas
                      page={slide.page}
                      meta={meta}
                      chapters={chapters}
                      photos={photos}
                      placeholder={slide.locked || !nearby}
                    />
                  ) : (
                    <CoverCanvas meta={meta} photos={photoList} />
                  )}

                  {slide.locked ? (
                    <span className="absolute inset-0 flex items-center justify-center bg-white/70 backdrop-blur-[3px]">
                      <Lock aria-hidden className="size-3.5 text-page-ink-faint" />
                    </span>
                  ) : null}
                </span>

                <span
                  className={`w-full truncate text-center text-[0.65rem] leading-tight ${
                    isActive ? "font-semibold text-periwinkle-deep" : "text-page-ink-faint"
                  }`}
                >
                  {slide.label}
                </span>
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
