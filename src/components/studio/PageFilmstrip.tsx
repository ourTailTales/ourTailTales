"use client";

import { Lock } from "lucide-react";
import { useCallback, useEffect, useRef } from "react";

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

/** Pixels of travel before a press counts as dragging rather than clicking. */
const DRAG_THRESHOLD = 5;

/** How long the strip must sit still before a scroll counts as having landed. */
const SETTLE_DELAY_MS = 120;

/**
 * The filmstrip: every page of the book, in order, along the bottom.
 *
 * Grab it anywhere and pull. Nobody should have to find a scrollbar to move
 * through their own book, and a five hundred page book makes that bar a few
 * pixels wide.
 *
 * Moving the strip also moves the page above it: once the strip stops
 * (a click, a drag released, or a native touch scroll coming to rest),
 * whichever thumbnail is nearest the center becomes the selection. A click
 * still commits immediately rather than waiting for that; the settle check is
 * what covers a drag or a swipe that never produces a click at all.
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

  /** Set while the customer is moving the strip themselves. */
  const panning = useRef(false);
  /** Where the drag began, and how far it has travelled. */
  const origin = useRef({ x: 0, scrollLeft: 0, moved: 0 });

  /** Set just before a keyboard move, so the effect below knows to move focus too. */
  const keyboardNav = useRef(false);

  useEffect(() => {
    if (panning.current) return;
    activeRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
      inline: "center",
    });
    if (keyboardNav.current) {
      keyboardNav.current = false;
      // preventScroll: the scrollIntoView above already handles bringing the
      // thumbnail into view, smoothly; a plain .focus() would additionally
      // jump the browser's own scroll anchoring and fight it.
      activeRef.current?.focus({ preventScroll: true });
    }
  }, [selected]);

  /** Debounce handle for the settle check below. */
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (settleTimer.current) clearTimeout(settleTimer.current);
  }, []);

  /**
   * Whatever thumbnail is nearest the strip's own center once scrolling goes
   * quiet — whether that scrolling was a drag, a native touch swipe, or the
   * `scrollIntoView` above finishing — becomes the selection. Debounced
   * rather than continuous: this only ever fires once movement has actually
   * stopped, so a page never flickers past while a thumb is still travelling.
   */
  const handleScroll = useCallback(() => {
    if (settleTimer.current) clearTimeout(settleTimer.current);
    settleTimer.current = setTimeout(() => {
      const strip = stripRef.current;
      if (!strip) return;
      const stripRect = strip.getBoundingClientRect();
      const centerX = stripRect.left + stripRect.width / 2;
      let closest: number | null = null;
      let closestDistance = Infinity;
      strip.querySelectorAll<HTMLElement>("[role=tab]").forEach((el) => {
        const rect = el.getBoundingClientRect();
        const distance = Math.abs(rect.left + rect.width / 2 - centerX);
        if (distance < closestDistance) {
          closestDistance = distance;
          closest = Number(el.dataset.position);
        }
      });
      if (closest !== null && closest !== selected) {
        onSelect(closest);
      }
    }, SETTLE_DELAY_MS);
  }, [selected, onSelect]);

  /**
   * Arrow-key roving tabindex for the tablist, per the WAI-ARIA tabs pattern.
   *
   * Every thumbnail used to be its own tab stop, so a fifty-chapter book put
   * five hundred stops between whatever came before the filmstrip and
   * whatever came after it. Only the active tab is now in the page's Tab
   * order; arrow keys move both the selection and focus among the rest.
   */
  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>): void => {
    const currentIndex = slides.findIndex((slide) => slide.position === selected);
    if (currentIndex === -1) return;

    let nextIndex: number;
    switch (event.key) {
      case "ArrowRight":
        nextIndex = Math.min(currentIndex + 1, slides.length - 1);
        break;
      case "ArrowLeft":
        nextIndex = Math.max(currentIndex - 1, 0);
        break;
      case "Home":
        nextIndex = 0;
        break;
      case "End":
        nextIndex = slides.length - 1;
        break;
      default:
        return;
    }

    event.preventDefault();
    const next = slides[nextIndex];
    if (!next || next.position === selected) return;
    keyboardNav.current = true;
    onSelect(next.position);
  };

  const startPan = (event: React.PointerEvent<HTMLDivElement>): void => {
    // Leave the middle and right buttons, and anything with its own gesture.
    if (event.button !== 0) return;
    // A finger already pans this strip natively. Driving scrollLeft as well
    // moves it twice as far as the finger and fights the momentum, so touch is
    // left to the browser and this handler exists for pointers that have no
    // drag-to-scroll of their own.
    if (event.pointerType === "touch") return;
    const strip = stripRef.current;
    if (!strip) return;
    panning.current = true;
    origin.current = { x: event.clientX, scrollLeft: strip.scrollLeft, moved: 0 };
  };

  const pan = (event: React.PointerEvent<HTMLDivElement>): void => {
    const strip = stripRef.current;
    if (!panning.current || !strip) return;
    const travelled = event.clientX - origin.current.x;
    origin.current.moved = Math.max(
      origin.current.moved,
      Math.abs(travelled),
    );
    // Only capture the pointer once this is clearly a drag, so a plain click
    // still reaches the thumbnail underneath.
    if (origin.current.moved > DRAG_THRESHOLD && !strip.hasPointerCapture(event.pointerId)) {
      strip.setPointerCapture(event.pointerId);
    }
    strip.scrollLeft = origin.current.scrollLeft - travelled;
  };

  const endPan = (event: React.PointerEvent<HTMLDivElement>): void => {
    const strip = stripRef.current;
    if (strip?.hasPointerCapture(event.pointerId)) {
      strip.releasePointerCapture(event.pointerId);
    }
    panning.current = false;
    // Let the click that follows know whether it was a drag. A touch that
    // scrolled the strip never reaches a thumbnail's click in the first place,
    // so this only has to speak for pointers we tracked ourselves.
    dragged.current =
      event.pointerType !== "touch" && origin.current.moved > DRAG_THRESHOLD;
  };

  /** True when the pointer that just went up had been dragging the strip. */
  const dragged = useRef(false);

  return (
    <div className="border-t border-page-line bg-white/85 backdrop-blur">
      <div
        ref={stripRef}
        onPointerDown={startPan}
        onPointerMove={pan}
        onPointerUp={endPan}
        onPointerCancel={endPan}
        onKeyDown={handleKeyDown}
        onScroll={handleScroll}
        className="filmstrip flex cursor-grab gap-3 overflow-x-auto px-4 py-3 active:cursor-grabbing sm:px-6"
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
                data-position={slide.position}
                aria-selected={isActive}
                tabIndex={isActive ? 0 : -1}
                onClick={() => {
                  // A drag that ended on a thumbnail was a drag, not a choice.
                  if (dragged.current) {
                    dragged.current = false;
                    return;
                  }
                  onSelect(slide.position);
                }}
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
