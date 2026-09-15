"use client";

import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent, type ReactNode } from "react";

import {
  BOOK_HEIGHT,
  BOOK_WIDTH,
  PAGE_HEIGHT,
  PAGE_WIDTH,
  SCENE_PERSPECTIVE,
  isEditableTarget,
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

export type BookViewerKeyboard = "none" | "global" | "local";
export type BookViewerFit = "funnel" | "preview";

export function BookViewer({
  sheets,
  coverOpen,
  onCoverOpened,
  onRequestOpen,
  onRequestClose,
  hideNav,
  footer,
  initialPage = 0,
  preferSingleFirstLeaf = true,
  maxPage,
  resumePage,
  requestAdvance = 0,
  requestRetreat = 0,
  compact = false,
  docked = false,
  keyboard = "global",
  fit = "funnel",
  clickToTurn = false,
  allowCoverClose = false,
  spreadLabel,
  onPageChange,
  onBusyChange,
  onBookHoverChange,
  coverBoardLeft = false,
  coverOpenMs,
  coverCloseMs,
  lockCover,
}: {
  sheets: FlipSheet[];
  coverOpen: boolean;
  onCoverOpened?: () => void;
  onRequestOpen?: () => void;
  onRequestClose?: () => void;
  hideNav?: boolean;
  footer?: ReactNode;
  /** 0 = closed cover; 1 = first open leaf. */
  initialPage?: number;
  /** Keep open funnel pages as right-only (blank left). */
  preferSingleFirstLeaf?: boolean;
  /** Block soft forward turns past this page until the funnel unlocks more. */
  maxPage?: number;
  /** Open (or catch up) to this page instead of the first leaf. */
  resumePage?: number;
  /** Increment to turn forward one page (e.g. after upload summary). */
  requestAdvance?: number;
  /** Increment to turn back one page. */
  requestRetreat?: number;
  /** Leave room below for a landing shelf. */
  compact?: boolean;
  /** Closed companion book in the editor rail — fill the column. */
  docked?: boolean;
  /** Preview dialog uses `local`; editing funnel uses `none`. */
  keyboard?: BookViewerKeyboard;
  /** Preview scales the full spread; funnel keeps the right-page column. */
  fit?: BookViewerFit;
  clickToTurn?: boolean;
  allowCoverClose?: boolean;
  spreadLabel?: string;
  onPageChange?: (page: number, closed: boolean) => void;
  onBusyChange?: (busy: boolean) => void;
  onBookHoverChange?: (hovering: boolean) => void;
  /** Hero: open cover board stays as the left leaf (no flat blank page on top). */
  coverBoardLeft?: boolean;
  coverOpenMs?: number;
  coverCloseMs?: number;
  /** Display-only cover — no peel to open or close. */
  lockCover?: boolean;
}) {
  const reducedMotion = usePrefersReducedMotion();
  const touchPrimary = useTouchPrimary();
  const faces = sheetsToFaces(sheets);

  const coverRef = useRef<HTMLDivElement>(null);
  const turningRootRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  const turn = usePageTurn({
    faces,
    reducedMotion,
    pageWidth: PAGE_WIDTH,
    pageHeight: PAGE_HEIGHT,
    initialPage,
    preferSingleFirstLeaf,
    maxPage,
    resumePage,
    requestAdvance,
    requestRetreat,
    coverOpen,
    coverOpenMs,
    coverCloseMs,
    allowCoverClose,
    layers: {
      turningRoot: turningRootRef,
    },
    onCoverOpened,
    onRequestOpen,
    onRequestClose,
  });

  const nextRef = useRef(turn.nextPage);
  const prevRef = useRef(turn.previousPage);
  useEffect(() => {
    nextRef.current = turn.nextPage;
    prevRef.current = turn.previousPage;
  }, [turn.nextPage, turn.previousPage]);

  useEffect(() => {
    onPageChange?.(turn.currentPage, turn.closed);
  }, [onPageChange, turn.currentPage, turn.closed]);

  useLayoutEffect(() => {
    onBusyChange?.(turn.busy);
  }, [onBusyChange, turn.busy]);

  const settledOpen = !turn.closed && !turn.coverAnimating;
  const previewSpread = fit === "preview" && !preferSingleFirstLeaf;
  const landingSpread = compact && coverOpen && coverBoardLeft;
  const dockedClosed = docked && !coverOpen;
  const centerSpread = (previewSpread && settledOpen) || landingSpread;
  const dockedColumn = docked && !centerSpread;
  const coverLocked = lockCover ?? dockedClosed;
  const frameWidth = centerSpread ? BOOK_WIDTH : PAGE_WIDTH;

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;

    const update = () => {
      const width = el.clientWidth;
      const next =
        fit === "preview"
          ? Math.min(
              1.05,
              (width - 32) / (previewSpread ? BOOK_WIDTH : PAGE_WIDTH),
              (Math.max(el.clientHeight, 160) - 12) / BOOK_HEIGHT,
            )
          : compact
            ? Math.min(
                dockedColumn ? 1 : width < 640 ? 1.05 : 0.92,
                landingSpread
                  ? (width * (width < 640 ? 0.96 : 0.82)) / BOOK_WIDTH
                  : dockedColumn
                    ? (width - 8) / PAGE_WIDTH
                    : (width * (width < 640 ? 0.9 : 0.7)) / PAGE_WIDTH,
                (Math.max(el.clientHeight, 160) - (width < 640 ? 12 : 24)) /
                  BOOK_HEIGHT,
              )
            : Math.min(
                1.15,
                width / PAGE_WIDTH,
                Math.max(280, window.innerHeight - 180) / BOOK_HEIGHT,
              ) * 0.82;
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
  }, [compact, dockedColumn, fit, previewSpread, landingSpread]);

  useEffect(() => {
    if (keyboard === "none") return;

    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
      if (isEditableTarget(event.target)) return;
      if (keyboard === "local") {
        const root = sceneRef.current;
        if (!root) return;
        const active = document.activeElement;
        const dialog = root.closest('[role="dialog"]');
        const isNode = (value: EventTarget | Element | null): value is Node =>
          value instanceof Node;
        const insideViewer =
          root === active ||
          (isNode(event.target) && root.contains(event.target)) ||
          (isNode(active) && root.contains(active));
        const insideDialog =
          dialog &&
          ((isNode(event.target) && dialog.contains(event.target)) ||
            (isNode(active) && dialog.contains(active)));
        if (!insideViewer && !insideDialog) return;
      }
      event.preventDefault();
      if (event.key === "ArrowRight") nextRef.current();
      else prevRef.current();
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [keyboard]);

  const swipeRef = useRef<{
    pointerId: number;
    x: number;
    y: number;
  } | null>(null);

  const handleSwipeDown = (event: PointerEvent<HTMLDivElement>) => {
    if (!clickToTurn) return;
    swipeRef.current = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
    };
  };

  const handleSwipeUp = (event: PointerEvent<HTMLDivElement>) => {
    const swipe = swipeRef.current;
    swipeRef.current = null;
    if (!clickToTurn || !swipe || swipe.pointerId !== event.pointerId) return;
    if (turn.turning || turn.busy) return;
    const dx = event.clientX - swipe.x;
    const dy = event.clientY - swipe.y;
    if (Math.abs(dx) < 56 || Math.abs(dx) < Math.abs(dy)) return;
    if (dx < 0) nextRef.current();
    else prevRef.current();
  };

  return (
    <div
      ref={sceneRef}
      className={`bv-scene${fit === "preview" ? " bv-scene--preview" : ""}`}
      tabIndex={keyboard === "local" ? 0 : undefined}
      onPointerDown={handleSwipeDown}
      onPointerUp={handleSwipeUp}
      onPointerCancel={() => {
        swipeRef.current = null;
      }}
    >
      <div ref={viewportRef} className="bv-viewport">
        <div
          className={`bv-anchor${settledOpen ? " bv-anchor--open" : " bv-anchor--closed"}${
            coverOpen ? " bv-anchor--cover-open" : ""
          }${centerSpread ? " bv-anchor--spread" : ""}`}
          style={{
            width: frameWidth * scale,
            height: BOOK_HEIGHT * scale,
            perspective: `${SCENE_PERSPECTIVE}px`,
            perspectiveOrigin: centerSpread ? "50% 45%" : "0% 45%",
          }}
        >
          <div
            className="bv-anchor__book"
            style={{
              width: BOOK_WIDTH,
              height: BOOK_HEIGHT,
              left: centerSpread ? "50%" : undefined,
              right: centerSpread ? "auto" : undefined,
              transform: centerSpread
                ? `translateX(-50%) scale(${scale})`
                : `scale(${scale})`,
              transformOrigin: centerSpread ? "top center" : "top right",
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
              onBookHoverChange={onBookHoverChange}
              coverBoardLeft={coverBoardLeft}
              clickToTurn={clickToTurn}
              onActivateSide={(side) => {
                if (side === "right") nextRef.current();
                else prevRef.current();
              }}
              lockCover={coverLocked}
            />
          </div>
        </div>
      </div>

      {!hideNav && <NavigationControls label={spreadLabel} />}

      {footer}
    </div>
  );
}
