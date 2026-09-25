"use client";

import { UploadCloud } from "lucide-react";

import {
  CLASSIC_SCRIM_HEIGHT,
  CLASSIC_SCRIM_STOPS,
  KEEPSAKE_PAW,
  KEEPSAKE_RULES,
  MONOGRAM_LETTER,
  PLATE_RULE_HALF_WIDTH,
  PLATE_RULE_Y,
  PLATE_YEARS_Y,
  PORTRAIT_MAT,
  PORTRAIT_WINDOW,
  coverUsesPhoto,
} from "@/lib/book/coverLayouts";
import { DOODLE_PATHS, DOODLE_STROKE } from "@/lib/book/design/primitives";
import { BRAND_PALETTE, type BookPalette } from "@/lib/book/palette";
import type { CoverLayoutId } from "@/types/book";

const DOG_SILHOUETTE_SRC = "/marketing/dog_silhoutte.png";

export type CoverChromeProps = {
  layoutId: CoverLayoutId;
  photoUrl: string | null;
  /** When set, the no-photo placeholder becomes a clickable "upload photos" CTA instead of static text. */
  onUploadClick?: () => void;
  /** The book's own colors — the paper and ink the quiet covers are printed in. */
  palette?: BookPalette;
  /** "2011–2024", printed under the name on a cover that carries no photo. */
  years?: string;
  /** The pet's first letter, set large behind a monogram cover. */
  initial?: string;
};

/**
 * Front-cover background: the photo treatment for a given layout, or — on the
 * two covers that carry no photograph — the whole design. The ourTailTales
 * mark stays off the front cover; it lives on the back cover's colophon
 * instead, so the customer's own photo and their pet's name are the only
 * things on the front. Name text is drawn on top by the caller
 * (CoverFrontArt for the static/print-facing view, CoverEditor for the live
 * one) so both share one definition of what each layout looks like.
 */
export function CoverLayoutChrome({
  layoutId,
  photoUrl,
  onUploadClick,
  palette = BRAND_PALETTE,
  years,
  initial,
}: CoverChromeProps) {
  // A cover made of type and paper is finished without a photograph, so it
  // never shows the "upload photos" plate.
  if (!coverUsesPhoto(layoutId)) {
    return layoutId === "monogram" ? (
      <MonogramPlate palette={palette} years={years} initial={initial} />
    ) : (
      <KeepsakePlate palette={palette} years={years} />
    );
  }

  if (!photoUrl) {
    const content = (
      <div className="absolute inset-[8%] z-10 flex flex-col items-center justify-center gap-5 rounded-sm border-[2.5px] border-dotted border-[#6f7788]/80 bg-[#c8d0dc]/45 px-6 backdrop-blur-[1px] transition-colors">
        {onUploadClick ? (
          <UploadCloud className="h-9 w-9 text-ink/70" aria-hidden strokeWidth={1.75} />
        ) : (
          <DogSilhouette />
        )}
        <p className="font-sans text-[0.8rem] font-medium tracking-[0.14em] text-ink sm:text-sm">
          {onUploadClick ? "Upload photos to get started" : "start their story"}
        </p>
      </div>
    );

    if (onUploadClick) {
      return (
        <div className="absolute inset-0 overflow-hidden bg-[#c8d0dc]/25">
          <button
            type="button"
            onClick={onUploadClick}
            aria-label="Upload photos"
            className="group absolute inset-0 h-full w-full cursor-pointer transition-colors hover:bg-[#c8d0dc]/35 focus-visible:outline focus-visible:outline-2 focus-visible:outline-periwinkle"
          >
            {content}
          </button>
        </div>
      );
    }

    return <div className="absolute inset-0 overflow-hidden bg-[#c8d0dc]/25">{content}</div>;
  }

  switch (layoutId) {
    case "minimal":
      return (
        <div className="absolute inset-0 overflow-hidden">
          <Photo url={photoUrl} />
          <div
            aria-hidden
            className="absolute inset-0"
            style={{ background: "rgb(37 42 58 / 0.4)" }}
          />
        </div>
      );

    case "editorial":
      return (
        <div className="absolute inset-0 overflow-hidden">
          <Photo url={photoUrl} />
          <div
            aria-hidden
            className="absolute inset-x-0 top-[40%] h-[27%]"
            style={{ background: "rgb(37 42 58 / 0.68)" }}
          />
        </div>
      );

    case "portrait":
      return (
        <div
          className="absolute inset-0 overflow-hidden"
          style={{ background: palette.paper }}
        >
          <div
            aria-hidden
            className="absolute"
            style={{
              left: `${(PORTRAIT_WINDOW.x - PORTRAIT_MAT) * 100}%`,
              top: `${(PORTRAIT_WINDOW.y - PORTRAIT_MAT) * 100}%`,
              width: `${(PORTRAIT_WINDOW.w + PORTRAIT_MAT * 2) * 100}%`,
              height: `${(PORTRAIT_WINDOW.h + PORTRAIT_MAT * 2) * 100}%`,
              background: "#ffffff",
              boxShadow: "0 8px 26px rgb(37 42 58 / 0.18)",
            }}
          />
          <div
            className="absolute overflow-hidden"
            style={{
              left: `${PORTRAIT_WINDOW.x * 100}%`,
              top: `${PORTRAIT_WINDOW.y * 100}%`,
              width: `${PORTRAIT_WINDOW.w * 100}%`,
              height: `${PORTRAIT_WINDOW.h * 100}%`,
            }}
          >
            <Photo url={photoUrl} />
          </div>
          <PlateRule palette={palette} />
          <PlateYears palette={palette} years={years} />
        </div>
      );

    case "classic":
    default:
      return (
        <div className="absolute inset-0 overflow-hidden">
          <Photo url={photoUrl} />
          <div
            aria-hidden
            className="absolute inset-x-0 bottom-0"
            style={{
              height: `${CLASSIC_SCRIM_HEIGHT * 100}%`,
              background: `linear-gradient(to top, ${CLASSIC_SCRIM_STOPS.map(
                (stop) => `rgb(37 42 58 / ${stop.alpha}) ${stop.at * 100}%`,
              ).join(", ")})`,
            }}
          />
        </div>
      );
  }
}

/* ------------------------- covers without a photo ------------------------- */

/** The engraved keepsake: two rules, a paw, and the years under the name. */
function KeepsakePlate({ palette, years }: { palette: BookPalette; years?: string }) {
  return (
    <div className="absolute inset-0 overflow-hidden" style={{ background: palette.paper }}>
      {KEEPSAKE_RULES.map((inset, index) => (
        <div
          key={inset}
          aria-hidden
          className="absolute"
          style={{
            inset: `${inset * 100}%`,
            border: `${index === 0 ? 2 : 1}px solid ${palette.inkSoft}`,
            opacity: index === 0 ? 0.45 : 0.32,
          }}
        />
      ))}
      <Paw palette={palette} />
      <PlateRule palette={palette} />
      <PlateYears palette={palette} years={years} />
    </div>
  );
}

/** The initial set large and pale behind the name. */
function MonogramPlate({
  palette,
  years,
  initial,
}: {
  palette: BookPalette;
  years?: string;
  initial?: string;
}) {
  return (
    <div className="absolute inset-0 overflow-hidden" style={{ background: palette.paper }}>
      {initial ? (
        <span
          aria-hidden
          className="absolute left-1/2 -translate-x-1/2 -translate-y-1/2 font-cover leading-none"
          style={{
            top: `${MONOGRAM_LETTER.cy * 100}%`,
            fontSize: `${MONOGRAM_LETTER.size * 100}cqw`,
            color: palette.accent,
            opacity: MONOGRAM_LETTER.opacity,
          }}
        >
          {initial}
        </span>
      ) : null}
      <PlateRule palette={palette} />
      <PlateYears palette={palette} years={years} />
    </div>
  );
}

function PlateRule({ palette }: { palette: BookPalette }) {
  return (
    <div
      aria-hidden
      className="absolute"
      style={{
        left: `${(0.5 - PLATE_RULE_HALF_WIDTH) * 100}%`,
        top: `${PLATE_RULE_Y * 100}%`,
        width: `${PLATE_RULE_HALF_WIDTH * 200}%`,
        height: "1px",
        background: palette.accent,
        opacity: 0.7,
      }}
    />
  );
}

function PlateYears({ palette, years }: { palette: BookPalette; years?: string }) {
  if (!years) return null;
  return (
    <p
      className="absolute inset-x-0 text-center font-sans"
      style={{
        top: `${PLATE_YEARS_Y * 100}%`,
        color: palette.inkSoft,
        fontSize: "3.2cqw",
        letterSpacing: "0.34em",
      }}
    >
      {years}
    </p>
  );
}

function Paw({ palette }: { palette: BookPalette }) {
  const { d, fill } = DOODLE_PATHS.paw;
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      className="absolute -translate-x-1/2 -translate-y-1/2"
      style={{
        left: "50%",
        top: `${KEEPSAKE_PAW.cy * 100}%`,
        width: `${KEEPSAKE_PAW.size * 100}%`,
        height: `${KEEPSAKE_PAW.size * 100}%`,
      }}
    >
      <path
        d={d}
        fill={fill ? palette.accent : "none"}
        fillOpacity={0.85}
        stroke={fill ? "none" : palette.accent}
        strokeWidth={DOODLE_STROKE}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function Photo({ url }: { url: string }) {
  return (
    /* eslint-disable-next-line @next/next/no-img-element -- local object URL */
    <img src={url} alt="" className="absolute inset-0 h-full w-full object-cover" />
  );
}

function DogSilhouette() {
  return (
    <div
      aria-hidden
      className="aspect-square h-[38%] max-h-44 w-auto bg-ink"
      style={{
        WebkitMaskImage: `url(${DOG_SILHOUETTE_SRC})`,
        maskImage: `url(${DOG_SILHOUETTE_SRC})`,
        WebkitMaskRepeat: "no-repeat",
        maskRepeat: "no-repeat",
        WebkitMaskPosition: "center",
        maskPosition: "center",
        WebkitMaskSize: "contain",
        maskSize: "contain",
      }}
    />
  );
}
