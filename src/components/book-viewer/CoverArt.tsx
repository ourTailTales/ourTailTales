"use client";

import { CoverLayoutChrome } from "@/components/book-viewer/CoverLayoutChrome";
import { CLOSING_LINE } from "@/lib/book/pagination";
import {
  DEFAULT_COVER_FONT,
  DEFAULT_COVER_LAYOUT,
  DEFAULT_COVER_NAME_SIZE,
  coverFontVar,
  coverTextTone,
  defaultNameAnchor,
  styleForAnchor,
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
 * chosen layout's photo treatment and the pet's name at their chosen spot,
 * font, and size (falling back to that layout's default anchor).
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
  const layoutId = meta?.coverLayoutId ?? DEFAULT_COVER_LAYOUT;
  const textOnLight = coverTextTone(layoutId) === "dark";
  const fontId = meta?.coverFontId ?? DEFAULT_COVER_FONT;
  const nameStyle = styleForAnchor(
    meta?.coverNameAnchor ?? defaultNameAnchor(layoutId),
  );
  const nameBold = meta?.coverNameBold ?? true;
  const nameUnderline = meta?.coverNameUnderline ?? false;
  const nameSize = meta?.coverNameSize ?? DEFAULT_COVER_NAME_SIZE;

  return (
    <div
      className={`relative h-full w-full overflow-hidden ${textOnLight ? "text-ink" : "text-white"}`}
    >
      <CoverLayoutChrome layoutId={layoutId} photoUrl={photoUrl ?? null} />

      {ready && petName ? (
        <p
          className="absolute z-10 max-w-[82%] leading-[1.05]"
          style={{
            ...nameStyle,
            fontFamily: coverFontVar(fontId),
            fontSize: `clamp(1rem, ${nameSize * 2.5}cqw, ${nameSize * 1.25}rem)`,
            fontWeight: nameBold ? 700 : 400,
            textDecoration: nameUnderline ? "underline" : "none",
            textUnderlineOffset: "0.15em",
            textShadow: textOnLight
              ? "0 1px 3px rgba(255,255,255,0.55)"
              : "0 1px 4px rgba(15,17,23,0.55)",
          }}
        >
          {petName}
        </p>
      ) : null}
    </div>
  );
}

/**
 * Hardcover back — styled after real memoir/photo-book backs: a centered
 * pull-quote (the dedication, or a fallback line) in the upper-middle third,
 * a small divider, and a publisher-style colophon anchored at the bottom.
 */
export function BackCoverArt({ dedication }: { dedication?: string }) {
  const body = dedication?.trim() || CLOSING_LINE;

  return (
    <div className="relative z-[1] flex h-full w-full flex-col bg-transparent px-[13%] py-[13%] text-page-ink">
      <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
        <p className="font-cover text-[clamp(0.95rem,2.3vw,1.15rem)] italic leading-7">
          &ldquo;{body}&rdquo;
        </p>
        <span aria-hidden className="text-[10px] tracking-[0.4em] text-page-ink/35">
          &bull;&nbsp;&bull;&nbsp;&bull;
        </span>
      </div>
      <div className="flex flex-col items-center gap-0.5 text-center">
        <p className="font-display text-[0.7rem] font-semibold tracking-wide text-page-ink/80">
          {brand.name}
        </p>
        <p className="font-sans text-[0.6rem] tracking-wide text-page-ink/45">
          {brand.domain}
        </p>
      </div>
    </div>
  );
}
