"use client";

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";

import {
  COVER_OPEN_MS,
  SOFT_TURN_MS,
  calculateFold,
  canGoBackward,
  canGoForward,
  defaultCornerForDirection,
  easeInOutCubic,
  isClosed,
  isSinglePageView,
  nextPageIndex,
  pointerForProgress,
  previousPageIndex,
  PAGE_HEIGHT,
  PAGE_WIDTH,
} from "./bookGeometry";
import type {
  Corner,
  FlipFace,
  FoldGeometry,
  InteractionState,
  Point,
  TurnDirection,
} from "./types";

type TurnLayers = {
  cover: RefObject<HTMLDivElement | null>;
  turningRoot: RefObject<HTMLDivElement | null>;
};

export function usePageTurn({
  faces,
  reducedMotion,
  pageWidth = PAGE_WIDTH,
  pageHeight = PAGE_HEIGHT,
  initialPage = 0,
  preferSingleFirstLeaf = true,
  maxPage,
  layers,
  onCoverOpened,
}: {
  faces: FlipFace[];
  reducedMotion: boolean;
  pageWidth?: number;
  pageHeight?: number;
  initialPage?: number;
  /** Keep page 1 as a centered right page with empty left peek (idle upload). */
  preferSingleFirstLeaf?: boolean;
  /**
   * Highest `currentPage` the reader may reach by turning forward.
   * Cover open (0 → 1) is always allowed. Soft turns past this are blocked
   * until the funnel unlocks the next step.
   */
  maxPage?: number;
  layers: TurnLayers;
  onCoverOpened?: () => void;
}) {
  const [currentPage, setCurrentPage] = useState(() =>
    initialPage > 0 ? initialPage : 0,
  );
  const [interaction, setInteraction] = useState<InteractionState>("idle");
  const [hoverCorner, setHoverCorner] = useState<Corner | null>(null);
  const [turning, setTurning] = useState<{
    faceIndex: number;
    direction: TurnDirection;
    corner: Corner;
    kind: "hard" | "soft";
  } | null>(null);

  const currentPageRef = useRef(currentPage);
  const interactionRef = useRef(interaction);
  const facesRef = useRef(faces);
  const maxPageRef = useRef(maxPage);
  const onCoverOpenedRef = useRef(onCoverOpened);
  const rafRef = useRef<number | null>(null);
  const coverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const foldRef = useRef<FoldGeometry | null>(null);
  const dragRef = useRef<{
    pointerId: number;
    corner: Corner;
    direction: TurnDirection;
    faceIndex: number;
    last: Point;
    lastT: number;
    velocity: number;
  } | null>(null);

  useEffect(() => {
    currentPageRef.current = currentPage;
  }, [currentPage]);
  useEffect(() => {
    interactionRef.current = interaction;
  }, [interaction]);
  useEffect(() => {
    facesRef.current = faces;
  }, [faces]);
  useEffect(() => {
    maxPageRef.current = maxPage;
  }, [maxPage]);
  useEffect(() => {
    onCoverOpenedRef.current = onCoverOpened;
  }, [onCoverOpened]);

  const busy =
    interaction === "completingTurn" ||
    interaction === "cancellingTurn" ||
    interaction === "openingCover" ||
    interaction === "closingCover" ||
    interaction === "dragging";

  const coverLayerRef = layers.cover;
  const turningLayerRef = layers.turningRoot;

  const applyCoverRotation = (deg: number, withTransition = false) => {
    const el = coverLayerRef.current;
    if (!el) return;
    const duration = reducedMotion ? 160 : COVER_OPEN_MS;
    el.style.transition = withTransition
      ? `transform ${duration}ms cubic-bezier(0.33, 0, 0.2, 1)`
      : "none";
    el.style.transform = `rotateY(${deg}deg)`;
  };

  const applyFoldToDom = (fold: FoldGeometry | null) => {
    foldRef.current = fold;
    const root = turningLayerRef.current;
    if (!root || !fold) {
      if (root) {
        root.style.opacity = "0";
        root.style.pointerEvents = "none";
        root.style.transform = "none";
      }
      return;
    }
    root.style.opacity = "1";
    root.style.pointerEvents = "none";
    root.style.transformOrigin = fold.transformOrigin;
    root.style.transform = `translateZ(1px) rotateY(${fold.flipDeg}deg)`;
    root.style.setProperty("--fold-front-shadow", fold.frontShadow);
    root.style.setProperty("--fold-back-shadow", fold.backShadow);
    root.style.setProperty("--fold-under-shadow", fold.underShadow);
    root.style.setProperty("--fold-progress", String(fold.progress));
  };

  /**
   * Cover stays put and only hinges left (rotateY). The right-page anchor in
   * BookViewer never moves — no book translate / frame expand.
   */
  const animateCover = (fromClosed: boolean, onDone: () => void) => {
    const duration = reducedMotion ? 160 : COVER_OPEN_MS;
    const el = coverLayerRef.current;

    if (coverTimerRef.current) {
      clearTimeout(coverTimerRef.current);
      coverTimerRef.current = null;
    }

    setInteraction(fromClosed ? "openingCover" : "closingCover");

    if (fromClosed) {
      setCurrentPage(1);
      applyCoverRotation(0, false);
      if (el) void el.offsetWidth;
      applyCoverRotation(-180, true);
    } else {
      applyCoverRotation(-180, false);
      if (el) void el.offsetWidth;
      applyCoverRotation(0, true);
    }

    coverTimerRef.current = setTimeout(() => {
      coverTimerRef.current = null;
      if (!fromClosed) {
        setCurrentPage(0);
      }
      applyCoverRotation(fromClosed ? -180 : 0, false);
      setInteraction("idle");
      onDone();
    }, duration);
  };

  useEffect(() => {
    if (initialPage >= 1 && currentPageRef.current <= 0) {
      setCurrentPage(initialPage);
      applyCoverRotation(-180, false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount / initialPage sync only
  }, [initialPage]);

  useEffect(() => {
    if (
      interaction === "openingCover" ||
      interaction === "closingCover" ||
      interaction === "dragging" ||
      interaction === "completingTurn" ||
      interaction === "cancellingTurn"
    ) {
      return;
    }
    applyCoverRotation(isClosed(currentPage) ? 0 : -180, false);
    applyFoldToDom(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- DOM sync from page state
  }, [currentPage, interaction, pageWidth]);

  const animateSoftTurn = (
    direction: TurnDirection,
    faceIndex: number,
    corner: Corner,
    fromProgress: number,
    toProgress: number,
    complete: boolean,
  ) => {
    const duration = reducedMotion ? 160 : SOFT_TURN_MS;
    const start = performance.now();
    const kind = facesRef.current[faceIndex]?.kind === "hard" ? "hard" : "soft";

    setTurning({ faceIndex, direction, corner, kind });
    setInteraction(complete ? "completingTurn" : "cancellingTurn");

    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const e = reducedMotion ? t : easeInOutCubic(t);
      const progress = fromProgress + (toProgress - fromProgress) * e;
      const point = pointerForProgress(
        corner,
        progress,
        pageWidth,
        pageHeight,
      );
      applyFoldToDom(
        calculateFold({
          pageWidth,
          pageHeight,
          corner,
          pointer: point,
          direction,
        }),
      );

      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        applyFoldToDom(null);
        setTurning(null);
        setInteraction("idle");
        if (complete) {
          setCurrentPage((page) =>
            direction === "forward"
              ? nextPageIndex(page)
              : previousPageIndex(page),
          );
        }
      }
    };
    rafRef.current = requestAnimationFrame(tick);
  };

  const nextPage = useCallback(() => {
    if (
      interactionRef.current === "completingTurn" ||
      interactionRef.current === "cancellingTurn" ||
      interactionRef.current === "openingCover" ||
      interactionRef.current === "closingCover" ||
      interactionRef.current === "dragging"
    ) {
      return;
    }
    const page = currentPageRef.current;
    if (!canGoForward(facesRef.current, page, maxPageRef.current)) return;

    if (isClosed(page)) {
      animateCover(true, () => onCoverOpenedRef.current?.());
      return;
    }

    const faceIndex = page + 1;
    animateSoftTurn(
      "forward",
      faceIndex,
      defaultCornerForDirection("forward"),
      0,
      1,
      true,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageWidth, pageHeight, reducedMotion]);

  const previousPage = useCallback(() => {
    if (
      interactionRef.current === "completingTurn" ||
      interactionRef.current === "cancellingTurn" ||
      interactionRef.current === "openingCover" ||
      interactionRef.current === "closingCover" ||
      interactionRef.current === "dragging"
    ) {
      return;
    }
    const page = currentPageRef.current;
    if (!canGoBackward(page)) return;

    if (page <= 1) {
      animateCover(false, () => setCurrentPage(0));
      return;
    }

    animateSoftTurn(
      "backward",
      page,
      defaultCornerForDirection("backward"),
      0,
      1,
      true,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageWidth, pageHeight, reducedMotion]);

  const goToCover = useCallback(() => {
    if (
      interactionRef.current === "completingTurn" ||
      interactionRef.current === "cancellingTurn" ||
      interactionRef.current === "openingCover" ||
      interactionRef.current === "closingCover" ||
      interactionRef.current === "dragging"
    ) {
      return;
    }
    if (isClosed(currentPageRef.current)) return;
    animateCover(false, () => setCurrentPage(0));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageWidth, reducedMotion]);

  const beginDrag = useCallback(
    (
      pointerId: number,
      corner: Corner,
      local: Point,
      target: Element,
    ) => {
      if (
        interactionRef.current === "completingTurn" ||
        interactionRef.current === "cancellingTurn" ||
        interactionRef.current === "openingCover" ||
        interactionRef.current === "closingCover" ||
        interactionRef.current === "dragging"
      ) {
        return;
      }
      const page = currentPageRef.current;
      if (isClosed(page)) {
        nextPage();
        return;
      }

      const direction: TurnDirection =
        corner === "top-right" || corner === "bottom-right"
          ? "forward"
          : "backward";

      if (
        direction === "forward" &&
        !canGoForward(facesRef.current, page, maxPageRef.current)
      )
        return;
      if (direction === "backward" && !canGoBackward(page)) return;

      const faceIndex = direction === "forward" ? page + 1 : page;
      const kind =
        facesRef.current[faceIndex]?.kind === "hard" ? "hard" : "soft";

      try {
        (target as HTMLElement).setPointerCapture(pointerId);
      } catch {
        /* ignore */
      }

      dragRef.current = {
        pointerId,
        corner,
        direction,
        faceIndex,
        last: local,
        lastT: performance.now(),
        velocity: 0,
      };
      setTurning({ faceIndex, direction, corner, kind });
      setInteraction("dragging");
      setHoverCorner(null);
      applyFoldToDom(
        calculateFold({
          pageWidth,
          pageHeight,
          corner,
          pointer: local,
          direction,
        }),
      );
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [nextPage, pageHeight, pageWidth],
  );

  const moveDrag = useCallback(
    (pointerId: number, local: Point) => {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== pointerId) return;
      const now = performance.now();
      const dt = Math.max(1, now - drag.lastT);
      drag.velocity = (local.x - drag.last.x) / dt;
      drag.last = local;
      drag.lastT = now;

      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        applyFoldToDom(
          calculateFold({
            pageWidth,
            pageHeight,
            corner: drag.corner,
            pointer: local,
            direction: drag.direction,
          }),
        );
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pageHeight, pageWidth],
  );

  const endDrag = useCallback(
    (pointerId: number) => {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== pointerId) return;
      dragRef.current = null;

      const progress = foldRef.current?.progress ?? 0;
      const flick =
        drag.direction === "forward"
          ? drag.velocity < -0.35
          : drag.velocity > 0.35;
      const complete = progress > 0.45 || (progress > 0.22 && flick);

      animateSoftTurn(
        drag.direction,
        drag.faceIndex,
        drag.corner,
        progress,
        complete ? 1 : 0,
        complete,
      );
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pageWidth, pageHeight, reducedMotion],
  );

  const setHover = useCallback((corner: Corner | null) => {
    if (
      interactionRef.current === "dragging" ||
      interactionRef.current === "completingTurn" ||
      interactionRef.current === "cancellingTurn" ||
      interactionRef.current === "openingCover" ||
      interactionRef.current === "closingCover"
    ) {
      return;
    }
    setHoverCorner(corner);
    setInteraction(corner ? "hoveringCorner" : "idle");
  }, []);

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (coverTimerRef.current) clearTimeout(coverTimerRef.current);
    };
  }, []);

  return {
    currentPage,
    interaction,
    hoverCorner,
    turning,
    busy,
    foldRef,
    nextPage,
    previousPage,
    goToCover,
    beginDrag,
    moveDrag,
    endDrag,
    setHover,
    canForward: canGoForward(faces, currentPage, maxPage),
    canBackward: canGoBackward(currentPage),
    closed: isClosed(currentPage),
    singlePage: isSinglePageView(currentPage, preferSingleFirstLeaf),
    coverAnimating:
      interaction === "openingCover" || interaction === "closingCover",
  };
}
