"use client";

import type { ReactNode, RefObject } from "react";

import type { FlipFace } from "./types";

/**
 * Flipping leaf: front + back faces hinged at the spine via rotateY on the root.
 */
export function TurningPage({
  rootRef,
  width,
  height,
  frontFace,
  backFace,
  side,
}: {
  rootRef: RefObject<HTMLDivElement | null>;
  width: number;
  height: number;
  frontFace: FlipFace | null;
  backFace: FlipFace | null;
  side: "left" | "right";
}) {
  return (
    <div
      ref={rootRef}
      className={`bv-turning bv-turning--${side}`}
      style={{ width, height }}
      aria-hidden
    >
      <div className="bv-turning__contact" />
      <div className="bv-turning__under-shadow" />
      <div aria-hidden className="bv-turning__thickness" />

      <div className="bv-turning__front">
        <Face key={frontFace?.id ?? "front-empty"} content={frontFace?.content} />
        {/* Same gutter as SoftPage so land shading matches mid-flip. */}
        <div aria-hidden className={`bv-gutter bv-gutter--${side}`} />
        <div className="bv-turning__fold-shadow" />
        <div className="bv-turning__highlight" />
      </div>

      <div className="bv-turning__back">
        <Face key={backFace?.id ?? "back-empty"} content={backFace?.content} />
        {/* Back is rotateY(180); opposite gutter keeps shade on the spine hinge. */}
        <div
          aria-hidden
          className={`bv-gutter bv-gutter--${side === "right" ? "left" : "right"}`}
        />
        <div className="bv-turning__back-shade" />
      </div>
    </div>
  );
}

function Face({ content }: { content: ReactNode | null | undefined }) {
  return (
    <div className="bv-turning__face-inner">
      {content ?? <div className="h-full w-full bg-transparent" />}
    </div>
  );
}
