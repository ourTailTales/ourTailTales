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
  coverOpen,
  onCoverOpened,
  onRequestOpen,
  hideNav,
  footer,
  initialPage = 0,
  preferSingleFirstLeaf = true,
  maxPage,
  requestAdvance = 0,
}: {
  sheets: FlipSheet[];
  coverOpen: boolean;
  onCoverOpened?: () => void;
  onRequestOpen?: () => void;
  hideNav?: boolean;
  footer?: ReactNode;
  /** 0 = closed cover; 1 = first open leaf. */
  initialPage?: number;
  /** Keep open funnel pages as right-only (blank left). */
  preferSingleFirstLeaf?: boolean;
  /** Block soft forward turns past this page until the funnel unlocks more. */
  maxPage?: number;
  /** Increment to turn forward one page (e.g. after upload summary). */
  requestAdvance?: number;
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
    requestAdvance,
    coverOpen,
    layers: {
      turningRoot: turningRootRef,
    },
    onCoverOpened,
    onRequestOpen,
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
      const width = el.clientWidth;
      const heightBudget = Math.max(280, window.innerHeight - 180);
      const next =
        Math.min(1.15, width / PAGE_WIDTH, heightBudget / BOOK_HEIGHT) * 0.82;
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

  const settledOpen = !turn.closed && !turn.coverAnimating;

  return (
    <div className="bv-scene">
      <div ref={viewportRef} className="bv-viewport">
        <div
          className={`bv-anchor${settledOpen ? " bv-anchor--open" : " bv-anchor--closed"}`}
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
              coverOpen={coverOpen}
              singlePage={turn.singlePage}
              coverAnimating={turn.coverAnimating}
              allowForward={turn.canForward}
              coverRef={coverRef}
              turningRootRef={turningRootRef}
              turning={turn.turning}
              hoverCorner={turn.hoverCorner}
              touchPrimary={touchPrimary}
              onCoverActivate={() => onRequestOpen?.()}
              onCoverSettled={turn.settleCover}
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
