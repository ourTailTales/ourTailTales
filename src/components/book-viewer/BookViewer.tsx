"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

import {
  BOOK_HEIGHT,
  BOOK_WIDTH,
  PAGE_HEIGHT,
  PAGE_WIDTH,
  SCENE_PERSPECTIVE,
  sheetsToFaces,
} from "./bookGeometry";
import { Book } from "./Book";
import { NavigationControls } from "./NavigationControls";
import { usePageTurn } from "./usePageTurn";
import type { FlipSheet } from "./types";
import {
  usePrefersReducedMotion,
  useTouchPrimary,
} from "@/components/hero/useHeroMedia";

import "./book-viewer.css";

export function BookViewer({
  sheets,
  onCoverOpened,
  hideNav,
  footer,
  initialPage = 0,
  preferSingleFirstLeaf = true,
  maxPage,
}: {
  sheets: FlipSheet[];
  onCoverOpened?: () => void;
  hideNav?: boolean;
  footer?: ReactNode;
  /** 0 = closed cover; 1 = first open leaf. */
  initialPage?: number;
  /** Keep the first leaf’s left page blank (upload step). */
  preferSingleFirstLeaf?: boolean;
  /** Block soft forward turns past this page until the funnel unlocks more. */
  maxPage?: number;
}) {
  const reducedMotion = usePrefersReducedMotion();
  const touchPrimary = useTouchPrimary();
  const faces = sheetsToFaces(sheets);

  const coverRef = useRef<HTMLDivElement>(null);
  const turningRootRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  const turn = usePageTurn({
    faces,
    reducedMotion,
    pageWidth: PAGE_WIDTH,
    pageHeight: PAGE_HEIGHT,
    initialPage,
    preferSingleFirstLeaf,
    maxPage,
    layers: {
      cover: coverRef,
      turningRoot: turningRootRef,
    },
    onCoverOpened,
  });

  const nextRef = useRef(turn.nextPage);
  const prevRef = useRef(turn.previousPage);
  useEffect(() => {
    nextRef.current = turn.nextPage;
    prevRef.current = turn.previousPage;
  }, [turn.nextPage, turn.previousPage]);

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;

    const update = () => {
      // Scale against the stable right-page column so open/close never resizes it.
      const width = el.clientWidth;
      const heightBudget = Math.max(280, window.innerHeight - 180);
      const next = Math.min(
        1.25,
        width / PAGE_WIDTH,
        heightBudget / BOOK_HEIGHT,
      );
      setScale(Number.isFinite(next) && next > 0 ? next : 1);
    };

    const ro = new ResizeObserver(update);
    ro.observe(el);
    window.addEventListener("resize", update);
    update();
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", update);
    };
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "ArrowRight") {
        event.preventDefault();
        nextRef.current();
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        prevRef.current();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const closedClip = turn.closed && !turn.coverAnimating;

  return (
    <div className="bv-scene">
      <div ref={viewportRef} className="bv-viewport">
        {/*
          Fixed right-page anchor: always centered, never moves.
          Full book is right-aligned inside it so the cover/right page
          stay put; the left page paints out to the left when open.
        */}
        <div
          className={`bv-anchor${closedClip ? " bv-anchor--closed" : " bv-anchor--open"}`}
          style={{
            width: PAGE_WIDTH * scale,
            height: BOOK_HEIGHT * scale,
            perspective: `${SCENE_PERSPECTIVE}px`,
            perspectiveOrigin: "0% 45%",
          }}
        >
          <div
            className="bv-anchor__book"
            style={{
              width: BOOK_WIDTH,
              height: BOOK_HEIGHT,
              transform: `scale(${scale})`,
              transformOrigin: "top right",
            }}
          >
            <Book
              faces={faces}
              currentPage={turn.currentPage}
              pageWidth={PAGE_WIDTH}
              pageHeight={PAGE_HEIGHT}
              closed={turn.closed}
              singlePage={turn.singlePage}
              coverAnimating={turn.coverAnimating}
              allowForward={turn.canForward}
              coverRef={coverRef}
              turningRootRef={turningRootRef}
              turning={turn.turning}
              hoverCorner={turn.hoverCorner}
              touchPrimary={touchPrimary}
              onCoverActivate={turn.nextPage}
              onBeginDrag={turn.beginDrag}
              onMoveDrag={turn.moveDrag}
              onEndDrag={turn.endDrag}
              onHoverCorner={turn.setHover}
            />
          </div>
        </div>
      </div>

      {!hideNav && (
        <NavigationControls
          onPrev={turn.previousPage}
          onNext={turn.nextPage}
          canPrev={turn.canBackward}
          canNext={turn.canForward}
          disabled={turn.busy}
        />
      )}

      {footer}
    </div>
  );
}
