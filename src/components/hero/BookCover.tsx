"use client";

import Image from "next/image";
import { motion } from "motion/react";
import type { ReactNode } from "react";

import { brand } from "@/lib/brand";

/** Shared board/page corner radius so every book frame clips to the cover. */
export const COVER_RADIUS = 14;
/** Spine-side corners stay square — the hinge edge of a hardcover isn’t rounded. */
const SPINE_RADIUS = 0;
const FORE_RADIUS = COVER_RADIUS;
const BOARD_THICKNESS = 36;
/** Visible cloth spine band on the front/back case (percent of width). */
const SPINE_BAND = "13.5%";
/** How far pages sit inside the back case (under the spine wrap). */
export const PAGE_SPINE_INSET = "10%";
/** Subtle board rim around pages — stays under the front cover when closed. */
export const PAGE_CASE_RIM = 5;
/** Case spine width — opaque wrap in front of the page block. */
export const CASE_SPINE_WIDTH = "13.5%";
/** How far the back board sits behind the front (px) for perspective. */
export const BACK_BOARD_Z = -14;
/** Page block depth between back and front covers. */
export const PAGE_BLOCK_Z = -7;
/**
 * Back board is slightly smaller so tip/parallax doesn’t let it halo past
 * the front cover (front stays the nearer, larger face).
 */
export const BACK_BOARD_SCALE = 0.962;
/** Nudge back down so rotateX tip doesn’t project its top above the cover. */
export const BACK_BOARD_Y = 5;

const coverRadii = `${SPINE_RADIUS}px ${FORE_RADIUS}px ${FORE_RADIUS}px ${SPINE_RADIUS}px`;
const coverClip = `inset(0 round ${SPINE_RADIUS}px ${FORE_RADIUS}px ${FORE_RADIUS}px ${SPINE_RADIUS}px)`;

const clothNoiseFine =
  "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='1.15' numOctaves='4' stitchTiles='stitch'/%3E%3CfeColorMatrix type='matrix' values='0 0 0 0 0.15 0 0 0 0 0.18 0 0 0 0 0.32 0 0 0 0.9 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")";

const clothNoiseCoarse =
  "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 180 180' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.55' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix type='matrix' values='0 0 0 0 0.12 0 0 0 0 0.14 0 0 0 0 0.28 0 0 0 0.85 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")";

const clothWeave =
  "url(\"data:image/svg+xml,%3Csvg width='6' height='6' viewBox='0 0 6 6' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0 0h3v3H0zm3 3h3v3H3z' fill='%23252a3a' fill-opacity='0.07'/%3E%3C/svg%3E\")";

const openTransition = {
  duration: 1.05,
  ease: [0.22, 0.9, 0.28, 1] as const,
};

const reducedTransition = { duration: 0.22, ease: "easeOut" as const };

/**
 * A single cover face. The 3D transform lives on an outer shell; rounding +
 * overflow live on an inner flat card so corners stay soft when the cover swings open.
 */
function CoverFace({
  side,
  children,
  className,
}: {
  side: "front" | "inside";
  children?: ReactNode;
  className?: string;
}) {
  const isInside = side === "inside";

  return (
    <div
      className="absolute inset-0"
      style={{
        transform: isInside ? "rotateY(180deg)" : undefined,
        transformStyle: "flat",
        backfaceVisibility: "hidden",
        WebkitBackfaceVisibility: "hidden",
      }}
    >
      <div
        className={`h-full w-full overflow-hidden ${className ?? ""}`}
        style={{
          borderRadius: coverRadii,
          clipPath: coverClip,
          WebkitClipPath: coverClip,
        }}
      >
        {children}
      </div>
    </div>
  );
}

export function BookCover({
  open,
  reducedMotion,
  onOpenIntent,
}: {
  open: boolean;
  reducedMotion: boolean;
  onOpenIntent?: () => void;
}) {
  return (
    <motion.button
      type="button"
      aria-label={open ? undefined : `Open the book — ${brand.title}`}
      aria-expanded={open}
      aria-hidden={open}
      onClick={() => {
        if (!open) onOpenIntent?.();
      }}
      onKeyDown={(event) => {
        if ((event.key === "Enter" || event.key === " ") && !open) {
          event.preventDefault();
          onOpenIntent?.();
        }
      }}
      className={`absolute inset-0 origin-left border-0 bg-transparent p-0 text-left focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-periwinkle ${
        open ? "pointer-events-none cursor-default" : "cursor-pointer"
      }`}
      tabIndex={open ? -1 : 0}
      style={{ transformStyle: "preserve-3d", transformOrigin: "left center" }}
      initial={false}
      animate={{
        // Only yaw around the shared spine — extra rotateX skews the hinge off the book.
        rotateY: open ? -155 : reducedMotion ? 0 : -12,
        rotateX: 0,
      }}
      transition={reducedMotion ? reducedTransition : openTransition}
    >
      {/* Front cloth */}
      <CoverFace
        side="front"
        className="relative bg-memory-blue shadow-[0_1px_1px_rgb(37_42_58/0.08),0_18px_40px_-18px_rgb(37_42_58/0.38)]"
      >
        {/* Base cloth tone — matte, slightly uneven */}
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            background: `
              radial-gradient(115% 90% at 22% 14%, rgb(255 255 255 / 0.22), transparent 48%),
              radial-gradient(80% 70% at 82% 78%, rgb(74 86 176 / 0.2), transparent 58%),
              linear-gradient(168deg, rgb(255 255 255 / 0.1), transparent 38%, rgb(37 42 58 / 0.12))
            `,
          }}
        />
        <div
          aria-hidden
          className="absolute inset-0 opacity-[0.28] mix-blend-multiply"
          style={{
            backgroundImage: clothNoiseCoarse,
            backgroundSize: "180px 180px",
          }}
        />
        <div
          aria-hidden
          className="absolute inset-0 opacity-[0.34] mix-blend-soft-light"
          style={{
            backgroundImage: clothNoiseFine,
            backgroundSize: "120px 120px",
          }}
        />
        <div
          aria-hidden
          className="absolute inset-0 opacity-80 mix-blend-multiply"
          style={{
            backgroundImage: clothWeave,
            backgroundSize: "5px 5px",
          }}
        />
        <div
          aria-hidden
          className="absolute inset-0 opacity-[0.14] mix-blend-overlay"
          style={{
            backgroundImage:
              "repeating-linear-gradient(98deg, transparent 0 2px, rgb(37 42 58 / 0.07) 2px 3px)",
          }}
        />

        {/* Spine band + hinge — same cloth family, soft depth only */}
        <div
          aria-hidden
          className="absolute inset-y-0 left-0"
          style={{ width: SPINE_BAND }}
        >
          <div
            className="absolute inset-0"
            style={{
              background: `
                linear-gradient(90deg,
                  rgb(37 42 58 / 0.1) 0%,
                  rgb(37 42 58 / 0.05) 22%,
                  rgb(255 255 255 / 0.06) 48%,
                  rgb(37 42 58 / 0.04) 78%,
                  rgb(37 42 58 / 0.08) 100%
                )
              `,
            }}
          />
          {/* Hinge crease where spine meets the front board */}
          <div
            className="absolute inset-y-0 right-0 w-[2px]"
            style={{
              background:
                "linear-gradient(90deg, rgb(37 42 58 / 0.14), transparent)",
            }}
          />
        </div>

        {/* Cover typography — title / subtitle / author */}
        <div className="relative flex h-full flex-col items-center justify-between px-[11%] py-[11%] pl-[17%] text-center text-ink">
          <div className="flex flex-col items-center gap-4 sm:gap-5">
            <Image
              src={brand.logo.src}
              alt=""
              width={128}
              height={128}
              className="h-[clamp(4.5rem,14vw,7.25rem)] w-[clamp(4.5rem,14vw,7.25rem)] drop-shadow-sm"
              priority
            />
            <h1 className="max-w-[16ch] text-balance-tight font-cover text-[clamp(1.35rem,3.4vw,2.15rem)] font-semibold leading-[1.12] tracking-[-0.01em] text-ink">
              {brand.title}
            </h1>
            <p className="max-w-[22ch] font-cover text-[clamp(0.85rem,1.7vw,1.05rem)] font-medium italic leading-snug tracking-wide text-ink-soft">
              {brand.line}
            </p>
          </div>

          <div className="flex flex-col items-center gap-2">
            <span aria-hidden className="h-px w-10 bg-ink/25" />
            <p className="font-cover text-[clamp(0.8rem,1.5vw,0.95rem)] font-medium tracking-[0.04em] text-ink">
              {brand.name}
            </p>
          </div>
        </div>
      </CoverFace>

      {/* Inside of cover */}
      <CoverFace side="inside" className="relative bg-[#eef1f8]">
        <div className="absolute inset-y-0 right-0 w-[5%] bg-ink/[0.05]" />
        <div className="absolute inset-[9%] rounded-md border border-ink/[0.04] bg-white/50" />
      </CoverFace>

      {/* Board thickness — only while closed */}
      {!open && (
        <>
          <div
            aria-hidden
            className="absolute left-0"
            style={{
              top: FORE_RADIUS * 0.45,
              bottom: FORE_RADIUS * 0.45,
              width: BOARD_THICKNESS,
              borderRadius: `0`,
              background:
                "linear-gradient(180deg, #d4e0f8 0%, #c9d8fa 42%, #b8c6ec 100%)",
              transform: "translateX(-100%) rotateY(-90deg)",
              transformOrigin: "right center",
              boxShadow: "inset 2px 0 5px rgb(37 42 58 / 0.14)",
            }}
          />
          <div
            aria-hidden
            className="absolute right-0"
            style={{
              top: FORE_RADIUS * 0.55,
              bottom: FORE_RADIUS * 0.55,
              width: BOARD_THICKNESS,
              borderRadius: `0 ${FORE_RADIUS * 0.45}px ${FORE_RADIUS * 0.45}px 0`,
              background:
                "linear-gradient(180deg, #d4e0f8 0%, #a8b8e8 42%, #8fa0d8 100%)",
              transform: `translateX(100%) rotateY(90deg)`,
              transformOrigin: "left center",
              boxShadow: "inset -2px 0 4px rgb(37 42 58 / 0.12)",
            }}
          />
          <div
            aria-hidden
            className="absolute top-0 h-[7px]"
            style={{
              left: SPINE_RADIUS,
              right: FORE_RADIUS * 0.45,
              background: "linear-gradient(90deg, #9aabd8, #dce6fa 40%, #c5d2f2)",
              transform: "translateY(-100%) rotateX(90deg)",
              transformOrigin: "bottom center",
              borderRadius: `0 ${FORE_RADIUS * 0.35}px 0 0`,
            }}
          />
          <div
            aria-hidden
            className="absolute bottom-0 h-[7px]"
            style={{
              left: SPINE_RADIUS,
              right: FORE_RADIUS * 0.45,
              background: "linear-gradient(90deg, #8fa0d8, #b8c6ec 40%, #a8b8e8)",
              transform: "translateY(100%) rotateX(-90deg)",
              transformOrigin: "top center",
              borderRadius: `0 0 ${FORE_RADIUS * 0.35}px 0`,
            }}
          />
        </>
      )}
    </motion.button>
  );
}

/**
 * Opaque case spine that sits in front of the page block (under the swinging
 * front cover). Keeps pages from reading through the hinge in 3D.
 */
export function CaseSpine({ open = false }: { open?: boolean }) {
  if (open) return null;

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-y-0 left-0 overflow-hidden bg-memory-blue"
      style={{
        width: CASE_SPINE_WIDTH,
        borderRadius: `${SPINE_RADIUS}px 0 0 ${SPINE_RADIUS}px`,
        boxShadow: "2px 0 8px rgb(37 42 58 / 0.12)",
        transform: `translateZ(${PAGE_BLOCK_Z / 2}px)`,
      }}
    >
      <div
        className="absolute inset-0"
        style={{
          background: `
            radial-gradient(120% 80% at 30% 20%, rgb(255 255 255 / 0.14), transparent 50%),
            linear-gradient(168deg, rgb(255 255 255 / 0.08), transparent 40%, rgb(37 42 58 / 0.14))
          `,
        }}
      />
      <div
        className="absolute inset-0 opacity-[0.26] mix-blend-multiply"
        style={{ backgroundImage: clothNoiseCoarse, backgroundSize: "180px 180px" }}
      />
      <div
        className="absolute inset-0 opacity-75 mix-blend-multiply"
        style={{ backgroundImage: clothWeave, backgroundSize: "5px 5px" }}
      />
      <div
        className="absolute inset-0"
        style={{
          background: `
            linear-gradient(90deg,
              rgb(37 42 58 / 0.18) 0%,
              rgb(37 42 58 / 0.08) 28%,
              rgb(255 255 255 / 0.06) 52%,
              rgb(37 42 58 / 0.08) 82%,
              rgb(37 42 58 / 0.2) 100%
            )
          `,
        }}
      />
      {/* Inner lip where pages tuck under the wrap */}
      <div
        className="absolute inset-y-0 right-0 w-[4px]"
        style={{
          background:
            "linear-gradient(90deg, rgb(37 42 58 / 0.28), rgb(37 42 58 / 0.05))",
        }}
      />
    </div>
  );
}

/**
 * Back hardcover case — same footprint as the front cover, pushed back in Z
 * so perspective keeps it mostly hidden behind the cover.
 */
export function BackCover({
  open = false,
  reducedMotion = false,
}: {
  open?: boolean;
  reducedMotion?: boolean;
}) {
  const recede = !open && !reducedMotion;

  return (
    <div
      aria-hidden
      className="absolute inset-0"
      style={{
        borderRadius: coverRadii,
        transform: recede
          ? `translateZ(${BACK_BOARD_Z}px) translateY(${BACK_BOARD_Y}px) scale(${BACK_BOARD_SCALE})`
          : undefined,
        transformOrigin: "center center",
        boxShadow:
          "0 2px 4px rgb(37 42 58 / 0.08), 0 22px 48px -16px rgb(37 42 58 / 0.32)",
      }}
    >
      <div
        className="absolute inset-0 overflow-hidden bg-memory-blue"
        style={{ borderRadius: coverRadii, clipPath: coverClip, WebkitClipPath: coverClip }}
      >
        <div
          className="absolute inset-0"
          style={{
            background: `
              radial-gradient(115% 90% at 22% 14%, rgb(255 255 255 / 0.18), transparent 48%),
              radial-gradient(80% 70% at 82% 78%, rgb(74 86 176 / 0.18), transparent 58%),
              linear-gradient(168deg, rgb(255 255 255 / 0.08), transparent 38%, rgb(37 42 58 / 0.14))
            `,
          }}
        />
        <div
          className="absolute inset-0 opacity-[0.26] mix-blend-multiply"
          style={{ backgroundImage: clothNoiseCoarse, backgroundSize: "180px 180px" }}
        />
        <div
          className="absolute inset-0 opacity-[0.3] mix-blend-soft-light"
          style={{ backgroundImage: clothNoiseFine, backgroundSize: "120px 120px" }}
        />
        <div
          className="absolute inset-0 opacity-75 mix-blend-multiply"
          style={{ backgroundImage: clothWeave, backgroundSize: "5px 5px" }}
        />

        {/* Spine wrap — covers the bound edge of the page block */}
        <div className="absolute inset-y-0 left-0" style={{ width: SPINE_BAND }}>
          <div
            className="absolute inset-0"
            style={{
              background: `
                linear-gradient(90deg,
                  rgb(37 42 58 / 0.16) 0%,
                  rgb(37 42 58 / 0.08) 28%,
                  rgb(255 255 255 / 0.05) 52%,
                  rgb(37 42 58 / 0.06) 78%,
                  rgb(37 42 58 / 0.14) 100%
                )
              `,
            }}
          />
          <div
            className="absolute inset-y-0 right-0 w-[3px]"
            style={{
              background:
                "linear-gradient(90deg, rgb(37 42 58 / 0.22), transparent)",
            }}
          />
        </div>

        {/* Recessed well under where pages sit */}
        <div
          className="absolute"
          style={{
            left: PAGE_SPINE_INSET,
            top: PAGE_CASE_RIM,
            right: PAGE_CASE_RIM,
            bottom: PAGE_CASE_RIM,
            borderRadius: `${SPINE_RADIUS}px ${FORE_RADIUS - 4}px ${FORE_RADIUS - 4}px ${SPINE_RADIUS}px`,
            boxShadow:
              "inset 0 0 0 1px rgb(37 42 58 / 0.08), inset 6px 0 14px rgb(37 42 58 / 0.12), inset 0 2px 6px rgb(37 42 58 / 0.06)",
            background: "rgb(37 42 58 / 0.06)",
          }}
        />

        <div
          className="absolute inset-y-[6%] left-0 w-[5px]"
          style={{
            background:
              "linear-gradient(90deg, rgb(37 42 58 / 0.22), transparent)",
          }}
        />
        <div
          className="absolute inset-y-[8%] right-0 w-[6px]"
          style={{
            background:
              "linear-gradient(270deg, rgb(37 42 58 / 0.18), transparent)",
          }}
        />
      </div>
    </div>
  );
}

export function PageStack({
  activity = 0,
  open = false,
  ajar = false,
}: {
  activity?: number;
  open?: boolean;
  /** Closed pose with cover cracked — fan pages so top edges read. */
  ajar?: boolean;
}) {
  const layers = 12;

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]"
    >
      {Array.from({ length: layers }, (_, index) => (
        <div
          key={index}
          className="absolute inset-0 rounded-[inherit] bg-[#fbfcff]"
          style={{
            transform: ajar
              ? `translateX(${index * 0.35}px)`
              : `translateX(${
                  index * (open ? 0.3 : 0.35) + activity * index * 0.1
                }px)`,
            boxShadow: "inset -1px 0 0 rgb(37 42 58 / 0.035)",
            opacity: 0.98 - index * 0.045,
            zIndex: layers - index,
          }}
        />
      ))}

      {/* Inner fore-edge — thickness reads inside the case, not past the board */}
      <div
        className="absolute inset-y-[4%] right-0 w-[5px] sm:w-[6px]"
        style={{
          borderRadius: "0 1px 1px 0",
          background: `
            repeating-linear-gradient(
              180deg,
              #ffffff 0px,
              #ffffff 1px,
              #eef1f6 1px,
              #e8ecf3 2px
            )
          `,
          boxShadow: "inset 2px 0 3px rgb(37 42 58 / 0.1)",
        }}
      />

      {/* Inner top edge when closed / ajar */}
      {(ajar || !open) && (
        <div
          className="absolute inset-x-[3%] top-0 h-[4px] sm:h-[5px]"
          style={{
            borderRadius: "1px 1px 0 0",
            background: `
              repeating-linear-gradient(
                90deg,
                #ffffff 0px,
                #ffffff 2px,
                #eef1f6 2px,
                #e6ebf3 3px
              )
            `,
            boxShadow: "0 1px 2px rgb(37 42 58 / 0.08)",
          }}
        />
      )}
    </div>
  );
}
