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
      <div className="bv-turning__under-shadow" />

      <div className="bv-turning__front">
        <Face content={frontFace?.content} />
        <div className="bv-turning__fold-shadow" />
      </div>

      <div className="bv-turning__back">
        <Face content={backFace?.content} />
        <div className="bv-turning__back-shade" />
      </div>
    </div>
  );
}

function Face({ content }: { content: ReactNode | null | undefined }) {
  return (
    <div className="bv-turning__face-inner">
      {content ?? <div className="h-full w-full bg-[#f7f9fd]" />}
    </div>
  );
}
