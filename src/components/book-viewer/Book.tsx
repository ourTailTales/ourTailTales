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
  singlePage,
  coverAnimating,
  allowForward = true,
  coverRef,
  turningRootRef,
  turning,
  hoverCorner,
  touchPrimary,
  onCoverActivate,
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

  // Page revealed under the flipping leaf (Turn.js stack).
  const underRightFace =
    turning?.direction === "forward"
      ? (faces[turning.faceIndex + 2] ?? null)
      : null;
  const underLeftFace =
    turning?.direction === "backward"
      ? (faces[turning.faceIndex - 2] ?? null)
      : null;

  const turningFront = turning ? (faces[turning.faceIndex] ?? null) : null;
  const turningBack = turning
    ? (faces[
        turning.direction === "forward"
          ? turning.faceIndex + 1
          : turning.faceIndex - 1
      ] ?? null)
    : null;
  const turningSide = turning?.direction === "forward" ? "right" : "left";

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

  // Single-page idle: blank left after the cover has finished opening.
  // Hide it (and its gutter shadow) while the cover is hinging — nothing
  // should paint on the left during open/close.
  const showBlankLeft = Boolean(singlePage && !closed && !coverAnimating);
  const hideLeft =
    Boolean(turning) &&
    turning?.direction === "backward" &&
    turning.faceIndex === currentPage;
  const hideRight =
    Boolean(turning) &&
    turning?.direction === "forward" &&
    turning.faceIndex === currentPage + 1;

  const coverMotion = Boolean(coverAnimating);

  return (
    <div
      className={`bv-book${coverMotion ? " bv-book--cover-anim" : ""}`}
      style={{ width: pageWidth * 2, height: pageHeight }}
      onPointerUp={(event) => onEndDrag(event.pointerId)}
      onPointerCancel={(event) => onEndDrag(event.pointerId)}
    >
      <div aria-hidden className="bv-shadow" />

      {/* Hard cover hinged at the spine — outside clipped slots so it can swing open. */}
      {faces[0]?.kind === "hard" && (
        <div
          className="bv-cover-hinge"
          style={{
            position: "absolute",
            top: 0,
            left: pageWidth,
            width: pageWidth,
            height: pageHeight,
            // Stay above interior pages for the whole hinge so the cover doesn’t pop under.
            zIndex: closed || coverAnimating ? 50 : 8,
            pointerEvents: closed && !coverAnimating ? "auto" : "none",
          }}
        >
          <HardPage
            coverRef={coverRef}
            width={pageWidth}
            height={pageHeight}
            front={faces[0].content}
            back={faces[1]?.content}
            role={closed ? "button" : undefined}
            aria-label={closed ? "Open the book" : undefined}
            onPointerDown={
              closed
                ? (event) => {
                    if (event.button === 0) onCoverActivate();
                  }
                : undefined
            }
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
            side="left"
            width={pageWidth}
            height={pageHeight}
            style={{ zIndex: 12 }}
          >
            {null}
          </SoftPage>
        )}
        {!closed && !coverMotion && underLeftFace && (
          <SoftPage
            side="left"
            width={pageWidth}
            height={pageHeight}
            style={{ zIndex: 10 }}
          >
            {underLeftFace.content}
          </SoftPage>
        )}
        {!closed && leftFace && !showBlankLeft && !hideLeft && !coverMotion && (
          <SoftPage
            side="left"
            width={pageWidth}
            height={pageHeight}
            style={{
              zIndex: getPageZIndex(currentPage, currentPage, {
                turning: Boolean(turning),
                turningIndex: turning?.faceIndex,
              }),
              ...peel("top-left"),
            }}
          >
            {leftFace.content}
          </SoftPage>
        )}
        {!closed && !touchPrimary && !coverMotion && (
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
        {!closed && underRightFace && (
          <SoftPage
            side="right"
            width={pageWidth}
            height={pageHeight}
            style={{ zIndex: 10 }}
          >
            {underRightFace.content}
          </SoftPage>
        )}
        {!closed && rightFace && !hideRight && (
          <SoftPage
            side="right"
            width={pageWidth}
            height={pageHeight}
            style={{
              zIndex: getPageZIndex(currentPage + 1, currentPage, {
                turning: Boolean(turning),
                turningIndex: turning?.faceIndex,
              }),
              ...peel("top-right"),
            }}
          >
            {rightFace.content}
          </SoftPage>
        )}

        {!closed && !touchPrimary && allowForward && (
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
