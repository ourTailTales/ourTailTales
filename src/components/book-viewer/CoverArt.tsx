"use client";

import Image from "next/image";
import type { ReactNode } from "react";

import { CLOSING_LINE } from "@/lib/book/pagination";
import { brand } from "@/lib/brand";
import type { BookMeta } from "@/types/book";
import type { PhotoAsset } from "@/types/photo";

const PLACEHOLDER_CAPTION = "start their story";
const DOG_SILHOUETTE_SRC = "/marketing/dog_silhoutte.png";

/** First usable cover image: explicit pick, else the first thumbnail we have. */
export function coverImageUrl(
  photos: Iterable<PhotoAsset>,
  preferredId?: string | null,
): string | null {
  const list = Array.from(photos);
  if (preferredId) {
    const preferred = list.find((photo) => photo.id === preferredId)?.thumbUrl;
    if (preferred) return preferred;
  }
  return list.find((photo) => photo.thumbUrl)?.thumbUrl || null;
}

/**
 * Hardcover front — placeholder until an album lands, then the print wrap:
 * full-bleed photo, brand mark, OURTAILTALES, pet name.
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

  if (!ready) {
    return (
      <div className="relative h-full w-full overflow-hidden">
        <div className="absolute inset-[8%] z-10 flex flex-col items-center justify-center gap-5 rounded-sm border-[2.5px] border-dotted border-[#6f7788]/80 bg-[#c8d0dc]/45 px-6 backdrop-blur-[1px]">
          <DogSilhouette />
          <p className="font-sans text-[0.8rem] font-medium tracking-[0.14em] text-ink sm:text-sm">
            {PLACEHOLDER_CAPTION}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-full w-full overflow-hidden text-white">
      {/* eslint-disable-next-line @next/next/no-img-element -- local object URL */}
      <img
        src={photoUrl ?? undefined}
        alt=""
        className="absolute inset-0 h-full w-full object-cover"
      />

      <div
        aria-hidden
        className="absolute inset-x-0 bottom-0 h-[36%]"
        style={{
          background:
            "linear-gradient(to top, rgb(37 42 58 / 0.72) 0%, rgb(37 42 58 / 0.42) 42%, rgb(37 42 58 / 0.1) 78%, transparent 100%)",
        }}
      />

      <div className="absolute left-[8%] top-[7%] z-10 flex items-center gap-2">
        <Image
          src={brand.logo.src}
          alt=""
          width={22}
          height={22}
          className="shrink-0"
        />
        <p className="font-sans text-[0.65rem] font-medium tracking-[0.22em] text-white/90 sm:text-xs">
          OURTAILTALES
        </p>
      </div>

      {petName ? (
        <div className="absolute inset-x-[10%] bottom-[9%] z-10">
          <p className="font-display text-[clamp(2.4rem,8vw,3.75rem)] font-bold leading-[1.05] text-white">
            {petName}
          </p>
          {years ? (
            <p className="mt-1.5 font-sans text-[0.7rem] tracking-wide text-white/85 sm:text-xs">
              {years}
            </p>
          ) : null}
        </div>
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

function lifespanText(meta?: BookMeta): string {
  if (!meta) return "";
  if (meta.birthYear && meta.deathYear) {
    return `${meta.birthYear} – ${meta.deathYear}`;
  }
  return meta.birthYear || meta.deathYear || "";
}
