"use client";

import type { ReactNode } from "react";

import { CoverLayoutChrome } from "@/components/book-viewer/CoverLayoutChrome";
import { CLOSING_LINE } from "@/lib/book/pagination";
import {
  DEFAULT_COVER_FONT,
  DEFAULT_COVER_LAYOUT,
  coverFontVar,
  defaultDatesPos,
  defaultNamePos,
} from "@/lib/book/coverLayouts";
import { brand } from "@/lib/brand";
import type { BookMeta } from "@/types/book";
import { getFullUrl } from "@/lib/photo/assetStore";
import type { PhotoAsset } from "@/types/photo";

/** First usable cover image: explicit pick, else the first thumbnail we have. */
export function coverImageUrl(
  photos: Iterable<PhotoAsset>,
  preferredId?: string | null,
): string | null {
  const list = Array.from(photos);
  if (preferredId) {
    // Prefer full-quality original for crisp cover display
    const fullUrl = getFullUrl(preferredId);
    if (fullUrl) return fullUrl;
    const preferred = list.find((photo) => photo.id === preferredId)?.thumbUrl;
    if (preferred) return preferred;
  }
  // Fallback: first photo, prefer full URL
  const first = list.find((photo) => photo.thumbUrl);
  if (first) return getFullUrl(first.id) ?? first.thumbUrl;
  return null;
}

/**
 * Hardcover front — placeholder until an album lands, then the print wrap:
 * chosen layout's photo treatment, the name and years at wherever they were
 * positioned in the cover editor (or that layout's default spot).
 */
export function CoverFrontArt({
  meta,
  photoUrl,
}: {
  meta?: BookMeta;
  photoUrl?: string | null;
}) {
  const ready = Boolean(photoUrl);
  const petName = meta?.petName.trim() ?? "";
  const years = ready ? lifespanText(meta) : "";
  const layoutId = meta?.coverLayoutId ?? DEFAULT_COVER_LAYOUT;
  const fontId = meta?.coverFontId ?? DEFAULT_COVER_FONT;
  const namePos = meta?.coverNamePos ?? defaultNamePos(layoutId);
  const datesPos = meta?.coverDatesPos ?? defaultDatesPos(layoutId);
  const nameBold = meta?.coverNameBold ?? true;
  const nameUnderline = meta?.coverNameUnderline ?? false;
  const nameSize = meta?.coverNameSize ?? 2;

  return (
    <div className="relative h-full w-full overflow-hidden text-white">
      <CoverLayoutChrome layoutId={layoutId} photoUrl={photoUrl ?? null} />

      {ready && petName ? (
        <p
          className="absolute z-10 max-w-[82%] text-center leading-[1.05]"
          style={{
            left: `${namePos.x}%`,
            top: `${namePos.y}%`,
            transform: "translate(-50%, -50%)",
            fontFamily: coverFontVar(fontId),
            fontSize: `clamp(1rem, ${nameSize * 2.5}cqw, ${nameSize * 1.25}rem)`,
            fontWeight: nameBold ? 700 : 400,
            textDecoration: nameUnderline ? "underline" : "none",
            textUnderlineOffset: "0.15em",
          }}
        >
          {petName}
        </p>
      ) : null}

      {ready && years ? (
        <p
          className="absolute z-10 text-center text-[0.7rem] tracking-wide text-white/85 sm:text-xs"
          style={{
            left: `${datesPos.x}%`,
            top: `${datesPos.y}%`,
            transform: "translate(-50%, -50%)",
          }}
        >
          {years}
        </p>
      ) : null}
    </div>
  );
}

export function CoverInsideArt({
  children,
  bleed = false,
}: {
  children?: ReactNode;
  bleed?: boolean;
}) {
  return (
    <div className="relative z-[1] h-full w-full bg-transparent">
      <div aria-hidden className="absolute inset-y-0 right-0 w-[5%] bg-ink/[0.05]" />
      {children ? (
        <div
          className={`relative flex h-full flex-col ${
            bleed ? "overflow-hidden" : "overflow-auto px-[1.35rem] py-[1.25rem]"
          }`}
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}

export function BackCoverArt({ dedication }: { dedication?: string }) {
  const body = dedication?.trim() || CLOSING_LINE;

  return (
    <div className="relative z-[1] flex h-full w-full flex-col justify-between bg-transparent px-[12%] py-[12%] text-page-ink">
      <p className="font-cover text-[clamp(0.95rem,2.2vw,1.15rem)] leading-7">
        {body}
      </p>
      <p className="font-sans text-[0.7rem] tracking-wide text-page-ink/70">
        {brand.name}
      </p>
    </div>
  );
}

function lifespanText(meta?: BookMeta): string {
  if (!meta) return "";
  if (meta.birthYear && meta.deathYear) {
    return `${meta.birthYear} – ${meta.deathYear}`;
  }
  return meta.birthYear || meta.deathYear || "";
}
