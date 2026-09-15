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
  resumePage,
  requestAdvance = 0,
  requestRetreat = 0,
  coverOpen,
  coverOpenMs,
  coverCloseMs,
  allowCoverClose = false,
  layers,
  onCoverOpened,
  onRequestOpen,
  onRequestClose,
}: {
  faces: FlipFace[];
  reducedMotion: boolean;
  pageWidth?: number;
  pageHeight?: number;
  initialPage?: number;
  /** Keep open funnel pages as right-only (blank left). */
  preferSingleFirstLeaf?: boolean;
  /**
   * Highest `currentPage` the reader may reach by turning forward.
   * Cover open is controlled separately via `coverOpen`.
   */
  maxPage?: number;
  /** When the cover opens (or new leaves unlock), land on this page. */
  resumePage?: number;
  /** Increment to programmatically turn forward one soft page. */
  requestAdvance?: number;
  /** Increment to programmatically turn back one soft page. */
  requestRetreat?: number;
  /** Controlled cover: CSS rotateY follows this; no drag / peek / replay. */
  coverOpen: boolean;
  /** Cover open animation duration (spring on hero). */
  coverOpenMs?: number;
  /** Cover close transition duration. */
  coverCloseMs?: number;
  /** When true, Previous on the first spread closes the cover. Preview only. */
  allowCoverClose?: boolean;
  layers: TurnLayers;
  onCoverOpened?: () => void;
  onRequestOpen?: () => void;
  onRequestClose?: () => void;
}) {
  const [currentPage, setCurrentPage] = useState(() =>
    coverOpen || initialPage > 0 ? Math.max(initialPage, 1) : 0,
  );
  const [interaction, setInteraction] = useState<InteractionState>("idle");
  const [hoverCorner, setHoverCorner] = useState<Corner | null>(null);
  const [coverAnimating, setCoverAnimating] = useState(false);
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
  const resumePageRef = useRef(resumePage);
  const coverOpenRef = useRef(coverOpen);
  const onCoverOpenedRef = useRef(onCoverOpened);
  const onRequestOpenRef = useRef(onRequestOpen);
  const onRequestCloseRef = useRef(onRequestClose);
  const allowCoverCloseRef = useRef(allowCoverClose);
  const rafRef = useRef<number | null>(null);
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

  const turningLayerRef = layers.turningRoot;

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
    resumePageRef.current = resumePage;
  }, [resumePage]);
  useEffect(() => {
    coverOpenRef.current = coverOpen;
  }, [coverOpen]);
  useEffect(() => {
    onCoverOpenedRef.current = onCoverOpened;
  }, [onCoverOpened]);
  useEffect(() => {
    onRequestOpenRef.current = onRequestOpen;
  }, [onRequestOpen]);
  useEffect(() => {
    onRequestCloseRef.current = onRequestClose;
  }, [onRequestClose]);
  useEffect(() => {
    allowCoverCloseRef.current = allowCoverClose;
  }, [allowCoverClose]);

  const turningBusy =
    interaction === "completingTurn" ||
    interaction === "cancellingTurn" ||
    interaction === "dragging";

  const applyFoldToDom = (fold: FoldGeometry | null) => {
    foldRef.current = fold;
    const root = turningLayerRef.current;
    if (!root) return;
    if (!fold) {
      root.style.opacity = "0";
      root.style.pointerEvents = "none";
      root.style.transform = "none";
      root.style.clipPath = "none";
      root.style.removeProperty("--fold-front-shadow");
      root.style.removeProperty("--fold-back-shadow");
      root.style.removeProperty("--fold-under-shadow");
      root.style.removeProperty("--fold-highlight");
      root.style.removeProperty("--fold-contact");
      root.style.removeProperty("--fold-clip");
      root.style.removeProperty("--fold-progress");
      return;
    }
    root.style.opacity = "1";
    root.style.pointerEvents = "none";
    root.style.transformOrigin = fold.transformOrigin;
    root.style.setProperty("--fold-progress", String(fold.progress));
    root.style.transform =
      fold.direction === "forward"
        ? "rotateY(calc(var(--bv-cover-open-angle, -180deg) * var(--fold-progress)))"
        : "rotateY(calc(var(--bv-left-open-angle, 0deg) + (180deg - var(--bv-left-open-angle, 0deg)) * var(--fold-progress)))";
    root.style.clipPath = fold.clipPath;
    root.style.setProperty("--fold-front-shadow", fold.frontShadow);
    root.style.setProperty("--fold-back-shadow", fold.backShadow);
    root.style.setProperty("--fold-under-shadow", fold.underShadow);
    root.style.setProperty("--fold-highlight", fold.highlight);
    root.style.setProperty("--fold-contact", fold.contactShadow);
    root.style.setProperty("--fold-clip", fold.clipPath);
  };

  const clearTurningAfterPaint = () => {
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = requestAnimationFrame(() => {
        applyFoldToDom(null);
        setTurning(null);
        setInteraction("idle");
      });
    });
  };

  const settleCover = useCallback(() => {
    setCoverAnimating(false);
    if (!coverOpenRef.current) {
      setCurrentPage(0);
      return;
    }
    if (currentPageRef.current < 1) setCurrentPage(1);
    onCoverOpenedRef.current?.();
  }, []);

  useEffect(() => {
    const page = currentPageRef.current;
    if (coverOpen) {
      if (page >= 1) return;
      const target = Math.max(1, resumePageRef.current ?? initialPage ?? 1);
      setCurrentPage(target);
      if (reducedMotion) {
        setCoverAnimating(false);
        onCoverOpenedRef.current?.();
      } else {
        setCoverAnimating(true);
      }
      return;
    }

    if (page <= 0) {
      setCoverAnimating(false);
      return;
    }

    if (reducedMotion) {
      setCurrentPage(0);
      setCoverAnimating(false);
    } else {
      setCoverAnimating(true);
    }
  }, [coverOpen, reducedMotion, initialPage]);

  if (
    coverOpen &&
    resumePage != null &&
    currentPage >= 1 &&
    resumePage > currentPage &&
    (maxPage === undefined || resumePage <= maxPage)
  ) {
    setCurrentPage(resumePage);
  }

  useEffect(() => {
    if (!coverAnimating) return;
    const ms = coverOpenRef.current
      ? (coverOpenMs ?? COVER_OPEN_MS)
      : (coverCloseMs ?? COVER_OPEN_MS);
    const timer = window.setTimeout(settleCover, ms + 80);
    return () => window.clearTimeout(timer);
  }, [coverAnimating, settleCover, coverOpenMs, coverCloseMs]);

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
    const fromPage = currentPageRef.current;

    setTurning({ faceIndex, direction, corner, kind });
    setInteraction(complete ? "completingTurn" : "cancellingTurn");
    applyFoldToDom(
      calculateFold({
        pageWidth,
        pageHeight,
        corner,
        pointer: pointerForProgress(
          corner,
          fromProgress,
          pageWidth,
          pageHeight,
        ),
        direction,
      }),
    );

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
      } else if (complete) {
        setCurrentPage(
          direction === "forward"
            ? nextPageIndex(fromPage)
            : previousPageIndex(fromPage),
        );
        clearTurningAfterPaint();
      } else {
        applyFoldToDom(null);
        setTurning(null);
        setInteraction("idle");
      }
    };
    rafRef.current = requestAnimationFrame(tick);
  };

  const nextPage = useCallback(() => {
    if (turningBusy || coverAnimating) return;
    const page = currentPageRef.current;
    if (isClosed(page) || !coverOpenRef.current) {
      onRequestOpenRef.current?.();
      return;
    }
    if (!canGoForward(facesRef.current, page, maxPageRef.current)) return;

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
  }, [pageWidth, pageHeight, reducedMotion, coverAnimating, turningBusy]);

  const requestAdvanceRef = useRef(requestAdvance);
  useEffect(() => {
    if (requestAdvance > requestAdvanceRef.current) {
      requestAdvanceRef.current = requestAdvance;
      nextPage();
    } else {
      requestAdvanceRef.current = requestAdvance;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestAdvance]);

  const previousPage = useCallback(() => {
    if (turningBusy || coverAnimating) return;
    const page = currentPageRef.current;
    // Funnel cover close is hover/scroll-driven. Preview may close from Previous.
    if (page <= 1) {
      if (allowCoverCloseRef.current && coverOpenRef.current) {
        onRequestCloseRef.current?.();
      }
      return;
    }
    if (!canGoBackward(page)) return;

    animateSoftTurn(
      "backward",
      page,
      defaultCornerForDirection("backward"),
      0,
      1,
      true,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageWidth, pageHeight, reducedMotion, coverAnimating, turningBusy]);

  const requestRetreatRef = useRef(requestRetreat);
  useEffect(() => {
    if (requestRetreat > requestRetreatRef.current) {
      requestRetreatRef.current = requestRetreat;
      previousPage();
    } else {
      requestRetreatRef.current = requestRetreat;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestRetreat]);

  const beginDrag = useCallback(
    (
      pointerId: number,
      corner: Corner,
      local: Point,
      target: Element,
    ) => {
      if (turningBusy || coverAnimating) return;
      const page = currentPageRef.current;
      if (isClosed(page) || !coverOpenRef.current) return;

      const direction: TurnDirection =
        corner === "top-right" || corner === "bottom-right"
          ? "forward"
          : "backward";

      if (
        direction === "forward" &&
        !canGoForward(facesRef.current, page, maxPageRef.current)
      )
        return;
      if (direction === "backward" && page <= 1) {
        if (allowCoverCloseRef.current && coverOpenRef.current) {
          onRequestCloseRef.current?.();
        }
        return;
      }

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
    [pageHeight, pageWidth, coverAnimating, turningBusy],
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
      interactionRef.current === "cancellingTurn"
    ) {
      return;
    }
    setHoverCorner(corner);
    setInteraction(corner ? "hoveringCorner" : "idle");
  }, []);

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return {
    currentPage,
    interaction,
    hoverCorner,
    turning,
    busy: turningBusy || coverAnimating,
    foldRef,
    nextPage,
    previousPage,
    beginDrag,
    moveDrag,
    endDrag,
    setHover,
    settleCover,
    canForward: coverOpen
      ? canGoForward(faces, currentPage, maxPage)
      : true,
    canBackward:
      currentPage > 1 ||
      Boolean(allowCoverClose && coverOpen && currentPage >= 1),
    closed: isClosed(currentPage),
    singlePage: isSinglePageView(currentPage, preferSingleFirstLeaf),
    coverAnimating,
  };
}
