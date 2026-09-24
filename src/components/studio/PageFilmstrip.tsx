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

/** How long the strip must sit still before it counts as no longer scrolling. */
const SCROLL_IDLE_MS = 100;

/**
 * The filmstrip: every page of the book, in order, along the bottom.
 *
 * Grab it anywhere and pull. Nobody should have to find a scrollbar to move
 * through their own book, and a five hundred page book makes that bar a few
 * pixels wide.
 *
 * Moving the strip also moves the page above it, live: whichever thumbnail
 * sits furthest to the left — nearest the strip's own leading edge — is the
 * selection, re-checked on every scroll frame rather than once movement
 * stops. The `scrollIntoView` sync effect below, which snaps the active
 * thumbnail flush to that same leading edge on a click or a keypress, is
 * held off for as long as anything (a drag or a native touch scroll) is
 * still moving the strip, so it never fights a gesture already in progress.
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

  /** Set for as long as the strip is actively moving, by any means. */
  const scrolling = useRef(false);
  const scrollIdleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // While anything is moving the strip — a JS-driven pointer drag, or a
    // native touch scroll this component never gets a start/end signal for —
    // this would drag the active thumbnail back toward the edge mid-gesture,
    // on top of whatever the customer's own hand is doing.
    if (panning.current || scrolling.current) return;
    activeRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
      inline: "start",
    });
    if (keyboardNav.current) {
      keyboardNav.current = false;
      // preventScroll: the scrollIntoView above already handles bringing the
      // thumbnail into view, smoothly; a plain .focus() would additionally
      // jump the browser's own scroll anchoring and fight it.
      activeRef.current?.focus({ preventScroll: true });
    }
  }, [selected]);

  /** rAF handle for the per-frame check below, so a burst of scroll events
   *  only ever schedules one read of the DOM per paint. */
  const scrollFrame = useRef<number | null>(null);
  useEffect(
    () => () => {
      if (scrollFrame.current !== null) cancelAnimationFrame(scrollFrame.current);
      if (scrollIdleTimer.current) clearTimeout(scrollIdleTimer.current);
    },
    [],
  );

  /**
   * Whatever thumbnail is furthest left — nearest the strip's own leading
   * edge — becomes the selection, checked on every scroll frame rather than
   * once the strip stops. `scrolling` just marks that movement is happening
   * right now, for the sync effect above to stay out of the way; it never
   * gates this check itself.
   */
  const handleScroll = useCallback(() => {
    scrolling.current = true;
    if (scrollIdleTimer.current) clearTimeout(scrollIdleTimer.current);
    scrollIdleTimer.current = setTimeout(() => {
      scrolling.current = false;
    }, SCROLL_IDLE_MS);

    if (scrollFrame.current !== null) return;
    scrollFrame.current = requestAnimationFrame(() => {
      scrollFrame.current = null;
      const strip = stripRef.current;
      if (!strip) return;
      const leadingEdge = strip.getBoundingClientRect().left;
      let closest: number | null = null;
      let closestDistance = Infinity;
      strip.querySelectorAll<HTMLElement>("[role=tab]").forEach((el) => {
        const distance = Math.abs(el.getBoundingClientRect().left - leadingEdge);
        if (distance < closestDistance) {
          closestDistance = distance;
          closest = Number(el.dataset.position);
        }
      });
      if (closest !== null && closest !== selected) {
        onSelect(closest);
      }
    });
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
                className="group flex w-[4.5rem] shrink-0 snap-start flex-col items-center gap-1.5 sm:w-20"
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
