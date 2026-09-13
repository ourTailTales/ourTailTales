"use client";

import {
  useCallback,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from "react";

import { HOVER_PEEL, getPageZIndex, hitTestCorner } from "./bookGeometry";
import { HardPage } from "./HardPage";
import { SoftPage } from "./SoftPage";
import { Spine } from "./Spine";
import { TurningPage } from "./TurningPage";
import type { Corner, FlipFace } from "./types";

type Point = { x: number; y: number };

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

  const peel = (match: Corner) =>
    !touchPrimary && hoverCorner === match
      ? ({
          transform:
            match.includes("right")
              ? `perspective(800px) rotateY(${-HOVER_PEEL * 40}deg)`
              : `perspective(800px) rotateY(${HOVER_PEEL * 40}deg)`,
          transformOrigin: match.includes("right")
            ? "left center"
            : "right center",
        } as const)
      : undefined;

  const showBlankLeft = Boolean(singlePage && !closed);
  const hideRight = Boolean(turning && turning.direction === "forward");
  const hideLeft = Boolean(turning && turning.direction === "backward");
  const coverMotion = Boolean(coverAnimating);
  const coverInteractive = !coverOpen || coverMotion;

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
      className={`bv-book${coverMotion ? " bv-book--cover-anim" : ""}`}
      style={{ width: pageWidth * 2, height: pageHeight }}
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
            zIndex: coverInteractive ? 50 : 8,
            pointerEvents: coverInteractive ? "auto" : "none",
          }}
        >
          <HardPage
            coverRef={coverRef}
            open={coverOpen}
            width={pageWidth}
            height={pageHeight}
            front={faces[0].content}
            back={faces[1]?.content}
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
        onPointerMove={handlePointerMove("left")}
        onPointerLeave={() => onHoverCorner(null)}
      >
        {!closed && showBlankLeft && (
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
              zIndex: hideLeft ? 10 : getPageZIndex(currentPage, currentPage, {
                turning: Boolean(turning),
                turningIndex: turning?.faceIndex,
              }),
              ...(!hideLeft ? peel("top-left") : undefined),
            }}
          >
            {visibleLeftFace.content}
          </SoftPage>
        )}
        {!closed && !touchPrimary && !coverMotion && !hideLeft && currentPage > 1 && (
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
        onPointerMove={handlePointerMove("right")}
        onPointerLeave={() => onHoverCorner(null)}
      >
        {visibleRightFace && (
          <SoftPage
            key={visibleRightFace.id}
            side="right"
            width={pageWidth}
            height={pageHeight}
            style={{
              zIndex: hideRight
                ? 10
                : getPageZIndex(currentPage + 1, currentPage, {
                    turning: Boolean(turning),
                    turningIndex: turning?.faceIndex,
                  }),
              ...(!hideRight ? peel("top-right") : undefined),
            }}
          >
            {visibleRightFace.content}
          </SoftPage>
        )}

        {!closed && !touchPrimary && allowForward && !hideRight && (
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

      <Spine openProgress={closed || coverMotion ? 0 : 1} />

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
