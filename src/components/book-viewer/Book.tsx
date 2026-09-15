"use client";

import {
  useCallback,
  useRef,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from "react";

import { getPageZIndex, hitTestCorner } from "./bookGeometry";
import { HardPage } from "./HardPage";
import { SoftPage } from "./SoftPage";
import { Spine } from "./Spine";
import { TurningPage } from "./TurningPage";
import type { Corner, FlipFace } from "./types";

type Point = { x: number; y: number };

function isInteractiveTarget(target: EventTarget | null): boolean {
  return target instanceof Element
    ? Boolean(
        target.closest(
          "button, a, input, textarea, select, label, [role='button'], [data-bv-interactive]",
        ),
      )
    : false;
}

export function Book({
  faces,
  currentPage,
  pageWidth,
  pageHeight,
  closed,
  coverOpen,
  singlePage,
  coverAnimating,
  allowForward = true,
  coverRef,
  turningRootRef,
  turning,
  hoverCorner,
  touchPrimary,
  onCoverActivate,
  onCoverSettled,
  onBeginDrag,
  onMoveDrag,
  onEndDrag,
  onHoverCorner,
  clickToTurn = false,
  coverBoardLeft = false,
  onActivateSide,
  onBookHoverChange,
  lockCover = false,
}: {
  faces: FlipFace[];
  currentPage: number;
  pageWidth: number;
  pageHeight: number;
  closed: boolean;
  coverOpen: boolean;
  singlePage?: boolean;
  coverAnimating?: boolean;
  /** When false, right-corner peel / drag affordances are hidden. */
  allowForward?: boolean;
  coverRef: RefObject<HTMLDivElement | null>;
  turningRootRef: RefObject<HTMLDivElement | null>;
  turning: {
    faceIndex: number;
    direction: "forward" | "backward";
    corner: Corner;
    kind: "hard" | "soft";
  } | null;
  hoverCorner: Corner | null;
  touchPrimary: boolean;
  onCoverActivate: () => void;
  onCoverSettled: () => void;
  onBeginDrag: (
    pointerId: number,
    corner: Corner,
    local: Point,
    target: Element,
  ) => void;
  onMoveDrag: (pointerId: number, local: Point) => void;
  onEndDrag: (pointerId: number) => void;
  onHoverCorner: (corner: Corner | null) => void;
  /** Preview: tap/click a page body to turn. Funnel leaves this off. */
  clickToTurn?: boolean;
  /** Skip the flat blank left leaf — the hard cover back is the left board. */
  coverBoardLeft?: boolean;
  onActivateSide?: (side: "left" | "right") => void;
  onBookHoverChange?: (hovering: boolean) => void;
  /** Closed companion: cover is display-only. */
  lockCover?: boolean;
}) {
  const leftFace = closed ? null : (faces[currentPage] ?? null);
  const rightFace = closed
    ? (faces[0] ?? null)
    : (faces[currentPage + 1] ?? null);

  const turningFront = turning ? (faces[turning.faceIndex] ?? null) : null;
  const turningBack = turning
    ? (faces[
        turning.direction === "forward"
          ? turning.faceIndex + 1
          : turning.faceIndex - 1
      ] ?? null)
    : null;
  const turningSide = turning?.direction === "forward" ? "right" : "left";

  const destinationRight =
    turning?.direction === "forward"
      ? (faces[turning.faceIndex + 2] ?? null)
      : null;
  const destinationLeft =
    turning?.direction === "backward"
      ? (faces[turning.faceIndex - 2] ?? null)
      : null;

  const localPoint = useCallback(
    (event: ReactPointerEvent, side: "left" | "right"): Point => {
      const book = event.currentTarget.closest(".bv-book") as HTMLElement | null;
      const rect = book?.getBoundingClientRect();
      if (!rect) return { x: 0, y: 0 };
      const x =
        side === "right"
          ? event.clientX - rect.left - pageWidth
          : event.clientX - rect.left;
      const y = event.clientY - rect.top;
      return { x, y };
    },
    [pageWidth],
  );

  const handleCornerDown = (corner: Corner, side: "left" | "right") =>
    (event: ReactPointerEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.stopPropagation();
      onBeginDrag(
        event.pointerId,
        corner,
        localPoint(event, side),
        event.currentTarget,
      );
    };

  const handlePointerMove = (side: "left" | "right") =>
    (event: ReactPointerEvent<HTMLDivElement>) => {
      onMoveDrag(event.pointerId, localPoint(event, side));
      if (touchPrimary || closed) return;
      const pt = localPoint(event, side);
      const hit = hitTestCorner(pt.x, pt.y, pageWidth, pageHeight);
      if (side === "right" && (hit === "top-right" || hit === "bottom-right")) {
        onHoverCorner(allowForward ? hit : null);
      } else if (
        side === "left" &&
        (hit === "top-left" || hit === "bottom-left")
      ) {
        onHoverCorner(hit);
      } else if (!event.buttons) {
        onHoverCorner(null);
      }
    };

  const pressRef = useRef<{
    pointerId: number;
    side: "left" | "right";
    x: number;
    y: number;
  } | null>(null);

  const handleBookHoverIn = () => onBookHoverChange?.(true);
  const handleBookHoverOut = (event: ReactPointerEvent<HTMLElement>) => {
    const next = event.relatedTarget;
    const book = event.currentTarget.closest(".bv-book");
    if (next instanceof Node && book?.contains(next)) return;
    onBookHoverChange?.(false);
  };

  const showBlankLeft = Boolean(singlePage && !closed && !coverBoardLeft);
  const hideRight = Boolean(turning && turning.direction === "forward");
  const hideLeft = Boolean(turning && turning.direction === "backward");
  const coverMotion = Boolean(coverAnimating);
  const coverInteractive = !lockCover && (!coverOpen || coverMotion);

  const visibleRightFace: FlipFace | null = closed
    ? null
    : hideRight
      ? destinationRight
      : rightFace;
  const visibleLeftFace: FlipFace | null =
    closed || showBlankLeft || coverMotion
      ? null
      : hideLeft
        ? destinationLeft
        : leftFace;

  return (
    <div
      className={`bv-book${coverMotion ? " bv-book--cover-anim" : ""}${coverBoardLeft ? " bv-book--cover-board-left" : ""}${clickToTurn ? " bv-book--preview" : ""}${turning ? " bv-book--turning" : ""}`}
      style={{ width: pageWidth * 2, height: pageHeight }}
      onPointerEnter={handleBookHoverIn}
      onPointerLeave={handleBookHoverOut}
      onPointerUp={(event) => onEndDrag(event.pointerId)}
      onPointerCancel={(event) => onEndDrag(event.pointerId)}
    >
      <div aria-hidden className="bv-shadow" />

      {faces[0]?.kind === "hard" && (
        <div
          className="bv-cover-hinge"
          style={{
            position: "absolute",
            top: 0,
            left: pageWidth,
            width: pageWidth,
            height: pageHeight,
            zIndex: turning ? 1 : coverInteractive ? 50 : 8,
            pointerEvents: coverInteractive ? "auto" : "none",
          }}
          onPointerEnter={handleBookHoverIn}
          onPointerLeave={handleBookHoverOut}
        >
          <HardPage
            coverRef={coverRef}
            open={coverOpen}
            width={pageWidth}
            height={pageHeight}
            front={faces[0].content}
            back={undefined}
            role={coverInteractive ? "button" : undefined}
            aria-label={coverInteractive ? "Open the book" : undefined}
            tabIndex={closed ? 0 : undefined}
            onClick={() => {
              if (coverOpen) return;
              onCoverActivate();
            }}
            onTransitionEnd={(event) => {
              if (event.propertyName !== "transform") return;
              if (event.target !== event.currentTarget) return;
              onCoverSettled();
            }}
            onAnimationEnd={(event) => {
              if (event.animationName !== "bv-cover-spring-open") return;
              if (event.target !== event.currentTarget) return;
              onCoverSettled();
            }}
            onKeyDown={(event) => {
              if (coverOpen) return;
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onCoverActivate();
              }
            }}
          />
        </div>
      )}

      <div
        className="bv-slot bv-slot--left"
        style={{ width: pageWidth }}
        onPointerDown={(event) => {
          if (!clickToTurn || closed || coverMotion) return;
          pressRef.current = {
            pointerId: event.pointerId,
            side: "left",
            x: event.clientX,
            y: event.clientY,
          };
        }}
        onPointerUp={(event) => {
          const press = pressRef.current;
          pressRef.current = null;
          if (!clickToTurn || !press || press.pointerId !== event.pointerId) return;
          if (press.side !== "left") return;
          if (isInteractiveTarget(event.target)) return;
          const distance = Math.hypot(
            event.clientX - press.x,
            event.clientY - press.y,
          );
          if (distance > 14) return;
          onActivateSide?.("left");
        }}
        onPointerEnter={handleBookHoverIn}
        onPointerMove={handlePointerMove("left")}
        onPointerLeave={(event) => {
          onHoverCorner(null);
          handleBookHoverOut(event);
        }}
      >
        {!closed && showBlankLeft && !coverMotion && (
          <SoftPage
            key="blank-left"
            side="left"
            width={pageWidth}
            height={pageHeight}
            style={{ zIndex: 12 }}
          >
            {null}
          </SoftPage>
        )}
        {visibleLeftFace && (
          <SoftPage
            key={visibleLeftFace.id}
            side="left"
            width={pageWidth}
            height={pageHeight}
            style={{
              zIndex: hideLeft
                ? 30
                : getPageZIndex(currentPage, currentPage, {
                    turning: Boolean(turning),
                    turningIndex: turning?.faceIndex,
                  }),
            }}
          >
            {visibleLeftFace.content}
          </SoftPage>
        )}
        {!closed && !coverMotion && !hideLeft && (currentPage > 1 || clickToTurn) && (
          <>
            <div
              className={`bv-corner-hot bv-corner-hot--tl ${hoverCorner === "top-left" ? "bv-corner-hot--peel" : ""}`}
              onPointerDown={handleCornerDown("top-left", "left")}
            />
            <div
              className={`bv-corner-hot bv-corner-hot--bl ${hoverCorner === "bottom-left" ? "bv-corner-hot--peel" : ""}`}
              onPointerDown={handleCornerDown("bottom-left", "left")}
            />
          </>
        )}
      </div>

      <div
        className="bv-slot bv-slot--right"
        style={{ width: pageWidth }}
        onPointerDown={(event) => {
          if (!clickToTurn || closed || coverMotion) return;
          pressRef.current = {
            pointerId: event.pointerId,
            side: "right",
            x: event.clientX,
            y: event.clientY,
          };
        }}
        onPointerUp={(event) => {
          const press = pressRef.current;
          pressRef.current = null;
          if (!clickToTurn || !press || press.pointerId !== event.pointerId) return;
          if (press.side !== "right") return;
          if (isInteractiveTarget(event.target)) return;
          const distance = Math.hypot(
            event.clientX - press.x,
            event.clientY - press.y,
          );
          if (distance > 14) return;
          onActivateSide?.("right");
        }}
        onPointerEnter={handleBookHoverIn}
        onPointerMove={handlePointerMove("right")}
        onPointerLeave={(event) => {
          onHoverCorner(null);
          handleBookHoverOut(event);
        }}
      >
        {visibleRightFace && (
          <SoftPage
            key={visibleRightFace.id}
            side="right"
            width={pageWidth}
            height={pageHeight}
            style={{
              zIndex: hideRight
                ? 30
                : getPageZIndex(currentPage + 1, currentPage, {
                    turning: Boolean(turning),
                    turningIndex: turning?.faceIndex,
                  }),
            }}
          >
            {visibleRightFace.content}
          </SoftPage>
        )}

        {!closed && allowForward && !hideRight && (
          <>
            <div
              className={`bv-corner-hot bv-corner-hot--tr ${hoverCorner === "top-right" ? "bv-corner-hot--peel" : ""}`}
              onPointerDown={handleCornerDown("top-right", "right")}
            />
            <div
              className={`bv-corner-hot bv-corner-hot--br ${hoverCorner === "bottom-right" ? "bv-corner-hot--peel" : ""}`}
              onPointerDown={handleCornerDown("bottom-right", "right")}
            />
          </>
        )}
      </div>

      <Spine
        openProgress={coverBoardLeft ? 1 : closed || coverMotion ? 0 : 1}
        gapFill={coverBoardLeft}
        hingeLeft={pageWidth}
        height={pageHeight}
      />

      <TurningPage
        rootRef={turningRootRef}
        width={pageWidth}
        height={pageHeight}
        frontFace={turningFront}
        backFace={turningBack}
        side={turningSide}
      />
    </div>
  );
}
