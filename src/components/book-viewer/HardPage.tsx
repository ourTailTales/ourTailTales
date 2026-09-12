"use client";

import type { CSSProperties, ReactNode } from "react";

export function HardPage({
  front,
  back,
  width,
  height,
  style,
  className,
  coverRef,
  onPointerDown,
  role,
  "aria-label": ariaLabel,
}: {
  front: ReactNode;
  back?: ReactNode;
  width: number;
  height: number;
  style?: CSSProperties;
  className?: string;
  coverRef?: React.RefObject<HTMLDivElement | null>;
  onPointerDown?: (event: React.PointerEvent) => void;
  role?: string;
  "aria-label"?: string;
}) {
  return (
    <div
      ref={coverRef}
      role={role}
      aria-label={ariaLabel}
      className={`bv-hard-page ${className ?? ""}`}
      onPointerDown={onPointerDown}
      style={{
        width,
        height,
        ...style,
      }}
    >
      <div className="bv-hard-face bv-hard-face--front">{front}</div>
      <div className="bv-hard-face bv-hard-face--back">
        {back ?? <div className="h-full w-full bg-[#eef1f8]" />}
      </div>
      <div aria-hidden className="bv-hard-thickness" />
    </div>
  );
}
