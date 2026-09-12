"use client";

import type { CSSProperties, ReactNode } from "react";

export function SoftPage({
  children,
  width,
  height,
  style,
  className,
  side,
}: {
  children?: ReactNode;
  width: number;
  height: number;
  style?: CSSProperties;
  className?: string;
  side: "left" | "right";
}) {
  return (
    <div
      className={`bv-soft-page bv-soft-page--${side} ${className ?? ""}`}
      style={{ width, height, ...style }}
    >
      <div className="bv-soft-page__content">{children ?? <Blank />}</div>
      <div aria-hidden className={`bv-gutter bv-gutter--${side}`} />
    </div>
  );
}

function Blank() {
  return <div className="h-full w-full bg-[#fbfcff]" />;
}
