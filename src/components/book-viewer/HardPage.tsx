"use client";

import type { CSSProperties, ReactNode } from "react";

export function HardPage({
  front,
  back,
  width,
  height,
  open = false,
  style,
  className,
  coverRef,
  onClick,
  onTransitionEnd,
  onAnimationEnd,
  onKeyDown,
  role,
  "aria-label": ariaLabel,
  tabIndex,
}: {
  front: ReactNode;
  back?: ReactNode;
  width: number;
  height: number;
  open?: boolean;
  style?: CSSProperties;
  className?: string;
  coverRef?: React.RefObject<HTMLDivElement | null>;
  onClick?: (event: React.MouseEvent) => void;
  onTransitionEnd?: (event: React.TransitionEvent) => void;
  onAnimationEnd?: (event: React.AnimationEvent) => void;
  onKeyDown?: (event: React.KeyboardEvent) => void;
  role?: string;
  "aria-label"?: string;
  tabIndex?: number;
}) {
  return (
    <div
      ref={coverRef}
      role={role}
      aria-label={ariaLabel}
      tabIndex={tabIndex}
      className={`bv-hard-page${open ? " bv-hard-page--open" : ""}${className ? ` ${className}` : ""}`}
      onClick={onClick}
      onTransitionEnd={onTransitionEnd}
      onAnimationEnd={onAnimationEnd}
      onKeyDown={onKeyDown}
      style={{
        width,
        height,
        ...style,
      }}
    >
      <div className="bv-hard-face bv-hard-face--front">{front}</div>
      <div className="bv-hard-face bv-hard-face--back">
        {back ?? <div className="h-full w-full bg-[#efe6d6]" />}
      </div>
      <div aria-hidden className="bv-hard-thickness" />
    </div>
  );
}
