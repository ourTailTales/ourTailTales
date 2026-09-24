"use client";

import { useMemo } from "react";

import { CoverFrontArt, coverImageUrl } from "@/components/book-viewer/CoverArt";
import { BLEED_INCHES, FIXED_SLOTS, LAYOUTS, PAGE_INCHES, TRIM_INCHES } from "@/lib/book/layouts";
import { CLOSING_LINE, possessivePetName } from "@/lib/book/pagination";
import { getFullUrl } from "@/lib/photo/assetStore";
import type { BookMeta, BookPage, Chapter, Slot } from "@/types/book";
import type { PhotoAsset } from "@/types/photo";

/**
 * One page of the book, drawn in the browser.
 *
 * The same normalized geometry the print renderer uses (`LAYOUTS`,
 * `FIXED_SLOTS`, both measured against the full bleed page with y running from
 * the top) so what a customer sees here is what gets bound. Type sizes are
 * expressed as a share of the page width in `cqw`, which makes one component
 * correct at every size it is used at — a 72px filmstrip thumbnail and a
 * 700px editor viewport are the same markup at two container widths.
 *
 * Crucially this renders from the book's *data*, not from the PDF. An edit
 * shows up on the next React render rather than after a round trip through a
 * renderer, which is what makes the editor feel like an editor.
 */

/** Page-space point → a share of the container width. */
const PAGE_PT = PAGE_INCHES * 72;
function pt(value: number): string {
  return `${((value / PAGE_PT) * 100).toFixed(4)}cqw`;
}

/** Percentage of the bleed page that the finished trim occupies. */
const TRIM_SCALE = (PAGE_INCHES / TRIM_INCHES) * 100;
const TRIM_OFFSET = (BLEED_INCHES / TRIM_INCHES) * 100;

export type PageCanvasProps = {
  page: BookPage;
  meta: BookMeta;
  chapters: Chapter[];
  photos: Map<string, PhotoAsset>;
  /**
   * Show the page as it will look bound — bleed cropped away. False renders
   * the printer's view, including the margin the binder cuts off.
   */
  trimmed?: boolean;
  /** Skip photos entirely. Used for filmstrip thumbnails far from the viewport. */
  placeholder?: boolean;
};

export function PageCanvas({
  page,
  meta,
  chapters,
  photos,
  trimmed = true,
  placeholder = false,
}: PageCanvasProps) {
  const chapter = useMemo(
    () => chapters.find((entry) => entry.id === page.chapterId),
    [chapters, page.chapterId],
  );

  const body = (
    <div
      className="absolute inset-0 bg-white"
      style={{ containerType: "inline-size" }}
    >
      <PageBody
        page={page}
        meta={meta}
        chapter={chapter}
        photos={photos}
        placeholder={placeholder}
      />
    </div>
  );

  if (!trimmed) {
    return <div className="relative aspect-square w-full overflow-hidden">{body}</div>;
  }

  // The layout lives on the bleed page; the finished book is the middle of it.
  return (
    <div className="relative aspect-square w-full overflow-hidden bg-white">
      <div
        className="absolute"
        style={{
          width: `${TRIM_SCALE}%`,
          height: `${TRIM_SCALE}%`,
          left: `-${TRIM_OFFSET}%`,
          top: `-${TRIM_OFFSET}%`,
        }}
      >
        {body}
      </div>
    </div>
  );
}

/** The front cover, at the same aspect and scale as an interior page. */
export function CoverCanvas({
  meta,
  photos,
}: {
  meta: BookMeta;
  photos: PhotoAsset[];
}) {
  const photoUrl = useMemo(
    () => coverImageUrl(photos, meta.coverPhotoId),
    [photos, meta.coverPhotoId],
  );

  return (
    <div
      className="relative aspect-square w-full overflow-hidden bg-white"
      style={{ containerType: "inline-size" }}
    >
      <CoverFrontArt meta={meta} photoUrl={photoUrl} />
    </div>
  );
}

/* ------------------------------- page kinds ------------------------------- */

function PageBody({
  page,
  meta,
  chapter,
  photos,
  placeholder,
}: {
  page: BookPage;
  meta: BookMeta;
  chapter: Chapter | undefined;
  photos: Map<string, PhotoAsset>;
  placeholder: boolean;
}) {
  switch (page.kind) {
    case "title":
      return <TitlePage page={page} meta={meta} photos={photos} placeholder={placeholder} />;
    case "dedication":
      return <DedicationPage meta={meta} />;
    case "chapter-opener":
      return (
        <OpenerPage page={page} chapter={chapter} photos={photos} placeholder={placeholder} />
      );
    case "closing":
      return <ClosingPage page={page} photos={photos} placeholder={placeholder} />;
    case "imprint":
      return <ImprintPage meta={meta} />;
    default:
      return <PhotoPage page={page} photos={photos} placeholder={placeholder} />;
  }
}

function TitlePage({
  page,
  meta,
  photos,
  placeholder,
}: {
  page: BookPage;
  meta: BookMeta;
  photos: Map<string, PhotoAsset>;
  placeholder: boolean;
}) {
  const years = lifespanText(meta);

  return (
    <>
      <p
        className="absolute inset-x-0 text-center font-display text-page-ink"
        style={{ bottom: pt(PAGE_PT * 0.74), fontSize: pt(46), lineHeight: 1 }}
      >
        {meta.petName || "Their Story"}
      </p>
      {years ? (
        <p
          className="absolute inset-x-0 text-center uppercase text-page-ink-faint"
          style={{
            bottom: pt(PAGE_PT * 0.7),
            fontSize: pt(10.5),
            letterSpacing: pt(2.6),
          }}
        >
          {years}
        </p>
      ) : null}

      <SlotPhoto
        slot={FIXED_SLOTS.titleHero}
        photoId={page.photoIds[0]}
        photos={photos}
        placeholder={placeholder}
      />

      <p
        className="absolute inset-x-0 text-center uppercase text-page-ink-faint"
        style={{
          bottom: pt(PAGE_PT * 0.085),
          fontSize: pt(8.5),
          letterSpacing: pt(3.4),
        }}
      >
        ourTailTales
      </p>
    </>
  );
}

function DedicationPage({ meta }: { meta: BookMeta }) {
  const text = meta.dedication.trim();

  if (!text) {
    return (
      <span
        aria-hidden
        className="absolute bg-page-ink-faint"
        style={{ left: "41%", top: "50%", width: "18%", height: "0.1%" }}
      />
    );
  }

  return (
    <p
      className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-center font-display italic text-page-ink"
      style={{
        width: "62%",
        fontSize: pt(text.length > 180 ? 14 : 17),
        lineHeight: 1.6,
      }}
    >
      {text}
    </p>
  );
}

function OpenerPage({
  page,
  chapter,
  photos,
  placeholder,
}: {
  page: BookPage;
  chapter: Chapter | undefined;
  photos: Map<string, PhotoAsset>;
  placeholder: boolean;
}) {
  const layout = LAYOUTS["chapter-opener"];
  const box = layout.textBox!;

  return (
    <>
      <SlotPhoto
        slot={layout.slots[0]}
        photoId={page.photoIds[0]}
        photos={photos}
        placeholder={placeholder}
      />

      <div
        className="absolute bg-lavender/55"
        style={{
          left: `${(box.x - 10 / PAGE_PT) * 100}%`,
          top: `${(box.y - 8 / PAGE_PT) * 100}%`,
          width: `${(box.w + 20 / PAGE_PT) * 100}%`,
          height: `${(box.h + 16 / PAGE_PT) * 100}%`,
        }}
      />

      <div
        className="absolute flex flex-col"
        style={{
          left: `${box.x * 100}%`,
          top: `${box.y * 100}%`,
          width: `${box.w * 100}%`,
          height: `${box.h * 100}%`,
          paddingTop: pt(16),
        }}
      >
        {chapter?.dateLabel ? (
          <p
            className="uppercase text-periwinkle"
            style={{ fontSize: pt(9), letterSpacing: pt(2.4), marginBottom: pt(10) }}
          >
            {chapter.dateLabel}
          </p>
        ) : null}

        <p
          className="font-display text-page-ink"
          style={{ fontSize: pt(30), lineHeight: 1.13 }}
        >
          {chapter?.title ?? ""}
        </p>

        <p
          className="overflow-hidden text-page-ink-soft"
          style={{ fontSize: pt(10.5), lineHeight: 1.52, marginTop: pt(12) }}
        >
          {chapter?.blurb ?? ""}
        </p>
      </div>
    </>
  );
}

function ClosingPage({
  page,
  photos,
  placeholder,
}: {
  page: BookPage;
  photos: Map<string, PhotoAsset>;
  placeholder: boolean;
}) {
  return (
    <>
      <SlotPhoto
        slot={FIXED_SLOTS.closingHero}
        photoId={page.photoIds[0]}
        photos={photos}
        placeholder={placeholder}
      />
      <p
        className="absolute inset-x-0 text-center font-display text-page-ink"
        style={{ bottom: pt(PAGE_PT * 0.1), fontSize: pt(20) }}
      >
        {CLOSING_LINE}
      </p>
    </>
  );
}

function ImprintPage({ meta }: { meta: BookMeta }) {
  return (
    <div
      className="absolute inset-x-0 flex flex-col items-center text-center text-page-ink-faint"
      style={{ bottom: pt(PAGE_PT * 0.13) }}
    >
      <p style={{ fontSize: pt(9), letterSpacing: pt(3.4) }}>
        ourTailTales
      </p>
      <p style={{ fontSize: pt(9), marginTop: pt(14) }}>
        Made from {possessivePetName(meta.petName)} own photographs.
      </p>
      <p style={{ fontSize: pt(9), marginTop: pt(4) }}>
        Printed and bound on demand.
      </p>
    </div>
  );
}

function PhotoPage({
  page,
  photos,
  placeholder,
}: {
  page: BookPage;
  photos: Map<string, PhotoAsset>;
  placeholder: boolean;
}) {
  if (!page.layoutId) return null;
  const layout = LAYOUTS[page.layoutId];

  return (
    <>
      {page.photoIds.map((photoId, index) => {
        const slot = layout.slots[index];
        if (!slot) return null;
        return (
          <SlotPhoto
            key={`${photoId}-${index}`}
            slot={slot}
            photoId={photoId}
            photos={photos}
            placeholder={placeholder}
          />
        );
      })}
    </>
  );
}

/* --------------------------------- pieces --------------------------------- */

function SlotPhoto({
  slot,
  photoId,
  photos,
  placeholder,
}: {
  slot: Slot;
  photoId: string | undefined;
  photos: Map<string, PhotoAsset>;
  placeholder: boolean;
}) {
  const style = {
    left: `${slot.x * 100}%`,
    top: `${slot.y * 100}%`,
    width: `${slot.w * 100}%`,
    height: `${slot.h * 100}%`,
  } as const;

  const photo = photoId ? photos.get(photoId) : undefined;
  const url = photoId && !placeholder ? (getFullUrl(photoId) ?? photo?.thumbUrl) : null;

  if (!url) {
    return <div className="absolute bg-memory-blue/60" style={style} />;
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element -- object-URL of a file the customer just picked
    <img
      src={url}
      alt=""
      draggable={false}
      className="absolute object-cover"
      style={style}
    />
  );
}

function lifespanText(meta: BookMeta): string {
  const birth = meta.birthYear.trim();
  const death = meta.deathYear.trim();
  if (birth && death) return `${birth}\u2013${death}`;
  return birth || death;
}
