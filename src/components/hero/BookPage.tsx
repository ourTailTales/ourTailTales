"use client";

import { motion } from "motion/react";
import type { ReactNode } from "react";

import { COVER_RADIUS } from "@/components/hero/BookCover";

/** Paper sits inside the board via padding; radius matches the inset. */
export const PAPER_INSET = 3;
export const PAPER_RADIUS = COVER_RADIUS - PAPER_INSET;

export function BookPage({
  side,
  children,
  tint = "white",
  fullWidth = false,
}: {
  side: "left" | "right";
  children: ReactNode;
  tint?: "white" | "lavender" | "memory";
  fullWidth?: boolean;
}) {
  const tintClass =
    tint === "lavender"
      ? "bg-lavender/30"
      : tint === "memory"
        ? "bg-[#f7f9fd]"
        : "bg-white";

  return (
    <div
      className={`relative h-full overflow-hidden px-[7%] py-[6%] ${fullWidth ? "w-full" : "w-1/2"} ${tintClass}`}
      style={{
        borderTopLeftRadius: side === "left" ? PAPER_RADIUS : 0,
        borderBottomLeftRadius: side === "left" ? PAPER_RADIUS : 0,
        borderTopRightRadius: side === "right" ? PAPER_RADIUS : 0,
        borderBottomRightRadius: side === "right" ? PAPER_RADIUS : 0,
        borderRightWidth: side === "left" ? 1 : undefined,
        borderRightColor: side === "left" ? "rgb(37 42 58 / 0.12)" : undefined,
        borderRightStyle: side === "left" ? "solid" : undefined,
      }}
    >
      <div className="relative z-[1] flex h-full min-h-0 flex-col">{children}</div>
      <div
        aria-hidden
        className={`pointer-events-none absolute inset-y-0 w-7 ${
          side === "left"
            ? "right-0 bg-gradient-to-l from-ink/[0.045] to-transparent"
            : "left-0 bg-gradient-to-r from-ink/[0.055] to-transparent"
        }`}
      />
    </div>
  );
}

export function BookSpread({
  left,
  right,
  pageActivity = 0,
  reducedMotion = false,
  open = false,
}: {
  left: ReactNode;
  right: ReactNode;
  pageActivity?: number;
  reducedMotion?: boolean;
  open?: boolean;
}) {
  return (
    <div
      className="absolute inset-0 flex overflow-hidden bg-[#fbfcff] shadow-[inset_0_0_0_1px_rgb(37_42_58/0.05)]"
      style={{ borderRadius: PAPER_RADIUS }}
    >
      <BookPage side="left" tint="lavender">
        {left}
      </BookPage>
      <div
        className="relative h-full w-1/2 overflow-hidden"
        style={{
          borderTopRightRadius: PAPER_RADIUS,
          borderBottomRightRadius: PAPER_RADIUS,
        }}
      >
        {pageActivity > 0 && open && !reducedMotion ? (
          <motion.div
            className="h-full w-full overflow-hidden"
            style={{
              borderTopRightRadius: PAPER_RADIUS,
              borderBottomRightRadius: PAPER_RADIUS,
              transformOrigin: "left center",
            }}
            animate={{
              rotateY: [0, -3.5 * pageActivity, 0, -1.8 * pageActivity, 0],
            }}
            transition={{ duration: 4.2, repeat: Infinity, ease: "easeInOut" }}
          >
            <BookPage side="right" tint="memory" fullWidth>
              {right}
            </BookPage>
          </motion.div>
        ) : (
          <BookPage side="right" tint="memory" fullWidth>
            {right}
          </BookPage>
        )}
      </div>
    </div>
  );
}
