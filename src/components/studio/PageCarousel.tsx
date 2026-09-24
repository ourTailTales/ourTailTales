"use client";

import { Lock, Maximize2 } from "lucide-react";
import { useCallback, useEffect, useRef } from "react";

import { CoverCanvas, PageCanvas } from "@/components/book-viewer/PageCanvas";
import type { StudioSlide } from "@/lib/book/studio";
import type { BookMeta, Chapter } from "@/types/book";
import type { PhotoAsset } from "@/types/photo";

/**
 * How many slides either side of the centered page stay mounted.
 *
 * Mirrors `PageFilmstrip`'s own windowing for the same reason — a five
 * hundred page book should not decode five hundred images to build a strip
 * that only shows three at a time. Two either side is enough to peek at
 * without the strip ever running out of neighbors to center on.
 */
const RENDER_WINDOW = 2;

/** Scroll idles this long before a swipe counts as having landed somewhere. */
const SETTLE_DELAY_MS = 120;

/**
 * The phone-sized way to read a book: one square page, centered, with the
 * next and previous pages peeking in at the edges under a soft fade.
 *
 * There is no drag handler here — the browser's native touch scrolling does
 * the panning, and CSS scroll-snap does the centering. This component's only
 * job is to notice where that native scroll settles and report it upward, and
 * to notice when the selection changes from elsewhere (the filmstrip, an
 * arrow key) and recenter to match.
 */
export function PageCarousel({
  slides,
  position,
  onSelect,
  meta,
  chapters,
  photos,
  photoList,
  onUnlock,
  onZoom,
}: {
  slides: StudioSlide[];
  position: number;
  onSelect: (position: number) => void;
  meta: BookMeta;
  chapters: Chapter[];
  photos: Map<string, PhotoAsset>;
  photoList: PhotoAsset[];
  onUnlock: () => void;
  onZoom: () => void;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  /** Set while a programmatic recenter is under way, so its own scroll events are ignored. */
  const programmatic = useRef(false);
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const lo = Math.max(0, position - RENDER_WINDOW);
  const hi = Math.min(slides.length - 1, position + RENDER_WINDOW);
  const windowed = slides.slice(lo, hi + 1);

  // Recenter whenever the selection moves — including from outside (the
  // filmstrip, an arrow key), not only from a swipe here. Instant, not
  // smooth: the window above was just rebuilt around the new position, so
  // there is no strip of intermediate pages to glide across anyway.
  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const target = track.querySelector<HTMLElement>(`[data-slide-position="${position}"]`);
    if (!target) return;
    programmatic.current = true;
    target.scrollIntoView({ inline: "center", block: "nearest", behavior: "auto" });
    const frame = requestAnimationFrame(() => {
      programmatic.current = false;
    });
    return () => cancelAnimationFrame(frame);
  }, [position, lo, hi]);

  useEffect(
    () => () => {
      if (settleTimer.current) clearTimeout(settleTimer.current);
    },
    [],
  );

  const handleScroll = useCallback(() => {
    if (programmatic.current) return;
    if (settleTimer.current) clearTimeout(settleTimer.current);
    settleTimer.current = setTimeout(() => {
      const track = trackRef.current;
      if (!track) return;
      const trackRect = track.getBoundingClientRect();
      const centerX = trackRect.left + trackRect.width / 2;
      let closest: number | null = null;
      let closestDistance = Infinity;
      track.querySelectorAll<HTMLElement>("[data-slide-position]").forEach((el) => {
        const rect = el.getBoundingClientRect();
        const distance = Math.abs(rect.left + rect.width / 2 - centerX);
        if (distance < closestDistance) {
          closestDistance = distance;
          closest = Number(el.dataset.slidePosition);
        }
      });
      if (closest !== null && closest !== position) {
        onSelect(closest);
      }
    }, SETTLE_DELAY_MS);
  }, [position, onSelect]);

  return (
    <div className="relative -mx-5 sm:-mx-8">
      <div
        ref={trackRef}
        onScroll={handleScroll}
        className="page-carousel flex snap-x snap-mandatory gap-4 overflow-x-auto px-10 pb-1 sm:px-14"
      >
        {windowed.map((slide, index) => {
          const slidePosition = lo + index;
          const isCurrent = slidePosition === position;
          return (
            <div
              key={slide.key}
              data-slide-position={slidePosition}
              className="w-[78vw] shrink-0 snap-center sm:w-[26rem]"
            >
              <div className="relative aspect-square w-full overflow-hidden rounded-xl bg-white shadow-[0_18px_50px_-24px_rgb(25_32_58/0.5)] ring-1 ring-page-line">
                <div className={slide.locked ? "blur-[7px] saturate-50" : ""}>
                  {slide.page ? (
                    <PageCanvas
                      page={slide.page}
                      meta={meta}
                      chapters={chapters}
                      photos={photos}
                      placeholder={slide.locked}
                    />
                  ) : (
                    <CoverCanvas meta={meta} photos={photoList} />
                  )}
                </div>

                {slide.locked && isCurrent ? (
                  <div className="absolute inset-0 flex items-center justify-center bg-white/45 p-5">
                    <button
                      type="button"
                      onClick={onUnlock}
                      className="rounded-xl bg-periwinkle px-5 py-3 text-sm font-semibold text-white shadow-lift hover:bg-periwinkle-deep"
                    >
                      Unlock this page
                    </button>
                  </div>
                ) : slide.locked ? (
                  <span className="absolute inset-0 flex items-center justify-center bg-white/40">
                    <Lock aria-hidden className="size-5 text-page-ink-faint" />
                  </span>
                ) : isCurrent ? (
                  <button
                    type="button"
                    onClick={onZoom}
                    aria-label={`Read ${slide.label} full size`}
                    className="absolute bottom-2.5 right-2.5 flex size-9 items-center justify-center rounded-full bg-white/90 text-page-ink-soft shadow-sm backdrop-blur transition-colors hover:text-periwinkle-deep"
                  >
                    <Maximize2 aria-hidden className="size-4" strokeWidth={2.25} />
                  </button>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>

      {/* The peek at each edge fades into the field behind it rather than
          cutting off sharply, so it reads as "more page" and not as a
          clipped thumbnail. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 left-0 w-10 bg-gradient-to-r from-paper to-transparent sm:w-14"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-paper to-transparent sm:w-14"
      />
    </div>
  );
}
