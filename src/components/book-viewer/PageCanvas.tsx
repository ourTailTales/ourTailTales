"use client";

import { useMemo, type CSSProperties } from "react";

import { CoverFrontArt, coverImageUrl } from "@/components/book-viewer/CoverArt";
import { BLEED_INCHES, PAGE_INCHES, TRIM_INCHES } from "@/lib/book/layouts";
import { CLOSING_LINE, possessivePetName, titlePageHeading } from "@/lib/book/pagination";
import {
  CLOSING_TEXT,
  DEDICATION_CARD,
  DOODLE_PATHS,
  DOODLE_STROKE,
  OPENER_CARD,
  OPENER_STICKER,
  OPENER_TEXT,
  OPENER_TYPE,
  TAPE_OUTLINE,
  TITLE_TEXT,
  dedicationType,
  designPage,
  photoCaption,
  photoWindow,
  type Box,
  type Doodle,
  type Print,
  type Tape,
} from "@/lib/book/scrapbook";
import { resolvePalette } from "@/lib/book/palette";
import { getFullUrl } from "@/lib/photo/assetStore";
import type { BookMeta, BookPage, Chapter } from "@/types/book";
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
      className="absolute inset-0"
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

const HAND = "var(--font-caveat)";
const SERIF = "var(--font-cover)";

/** A normalized page coordinate as a share of the page. */
function pct(value: number): string {
  return `${(value * 100).toFixed(4)}%`;
}

function boxStyle(box: Box, rotation = 0): CSSProperties {
  return {
    left: pct(box.cx - box.w / 2),
    top: pct(box.cy - box.h / 2),
    width: pct(box.w),
    height: pct(box.h),
    transform: rotation ? `rotate(${rotation}deg)` : undefined,
  };
}

/** The same two-layer lift the PDF draws, as a real blur here. */
const PRINT_SHADOW = `0 ${pt(1.8)} ${pt(6)} rgb(37 42 58 / 0.16), 0 ${pt(0.6)} ${pt(1.5)} rgb(37 42 58 / 0.12)`;

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
  const palette = useMemo(
    () => resolvePalette(meta),
    [meta],
  );
  const design = useMemo(
    () =>
      designPage(page, {
        orientationOf: (id) => photos.get(id)?.orientation,
        captionOf: (id) => photoCaption(photos.get(id)?.capturedAt),
        palette,
      }),
    [page, photos, palette],
  );

  return (
    <div
      className="absolute inset-0"
      style={
        {
          background: design.paper,
          // The pet's palette, for every piece of type on the page.
          "--bk-ink": palette.ink,
          "--bk-ink-soft": palette.inkSoft,
          "--bk-ink-faint": palette.inkFaint,
          "--bk-accent": palette.accent,
        } as CSSProperties
      }
    >
      {design.scraps.map((scrap, index) => (
        <div
          key={`scrap-${index}`}
          aria-hidden
          className="absolute"
          style={{ ...boxStyle(scrap, scrap.rotation), background: scrap.color, opacity: scrap.opacity }}
        />
      ))}

      {page.kind === "dedication" ? <Card box={DEDICATION_CARD} /> : null}
      {page.kind === "chapter-opener" ? <Card box={OPENER_CARD} /> : null}

      {design.prints.map((print, index) => (
        <PrintView
          // Keyed by position, not by photo: a page turning to a different
          // photo swaps `src` on an element already showing something,
          // instead of rebuilding it from a blank start (a white flash).
          key={`print-${index}`}
          print={print}
          photos={photos}
          placeholder={placeholder}
        />
      ))}
      {design.prints.flatMap((print, index) =>
        print.tapes.map((tape, tapeIndex) => (
          <TapeView key={`tape-${index}-${tapeIndex}`} tape={tape} />
        )),
      )}
      {page.kind === "dedication" ? (
        <TapeView
          tape={{
            cx: DEDICATION_CARD.cx,
            cy: DEDICATION_CARD.cy - DEDICATION_CARD.h / 2,
            w: 0.13,
            h: 0.036,
            rotation: -3,
            color: palette.tape[1] ?? palette.tape[0]!,
            opacity: 0.82,
          }}
        />
      ) : null}

      {design.doodles.map((doodle, index) => (
        <DoodleView key={`doodle-${index}`} doodle={doodle} />
      ))}

      <PageWords page={page} meta={meta} chapter={chapter} />
    </div>
  );
}

function PageWords({
  page,
  meta,
  chapter,
}: {
  page: BookPage;
  meta: BookMeta;
  chapter: Chapter | undefined;
}) {
  switch (page.kind) {
    case "title":
      return <TitleWords meta={meta} />;
    case "dedication":
      return <DedicationWords meta={meta} />;
    case "chapter-opener":
      return <OpenerWords chapter={chapter} />;
    case "closing":
      return (
        <p
          className="absolute inset-x-0 text-center text-(--bk-ink)"
          style={{
            bottom: pt(PAGE_PT * (1 - CLOSING_TEXT.baseline) - CLOSING_TEXT.size * 0.28),
            fontFamily: HAND,
            fontWeight: 600,
            fontSize: pt(CLOSING_TEXT.size),
            lineHeight: 1,
          }}
        >
          {CLOSING_LINE}
        </p>
      );
    case "imprint":
      return <ImprintWords meta={meta} />;
    default:
      return null;
  }
}

function TitleWords({ meta }: { meta: BookMeta }) {
  const years = lifespanText(meta);
  const heading = titlePageHeading(meta.petName);
  // Caveat averages about 0.42em a character; a long name steps down to fit
  // the same 78% of the page the PDF allows it.
  const size = Math.max(
    28,
    Math.min(TITLE_TEXT.headingSize, (PAGE_PT * 0.78) / (heading.length * 0.42)),
  );

  return (
    <>
      <p
        className="absolute inset-x-0 whitespace-nowrap text-center text-(--bk-ink)"
        style={{
          bottom: pt(PAGE_PT * (1 - TITLE_TEXT.headingBaseline) - size * 0.28),
          fontFamily: HAND,
          fontWeight: 600,
          fontSize: pt(size),
          lineHeight: 1,
        }}
      >
        {heading}
      </p>
      {years ? (
        <div
          className="absolute inset-x-0 flex justify-center"
          style={{ top: pct(TITLE_TEXT.yearsCy), transform: "translateY(-50%)" }}
        >
          <span
            className="rounded-full border border-(--bk-accent)/80 uppercase text-(--bk-accent)"
            style={{
              fontSize: pt(10),
              letterSpacing: pt(2.4),
              padding: `${pt(4)} ${pt(13)}`,
              lineHeight: 1,
            }}
          >
            {years}
          </span>
        </div>
      ) : null}
      <p
        className="absolute inset-x-0 text-center uppercase text-(--bk-ink-faint)"
        style={{
          bottom: pt(PAGE_PT * (1 - TITLE_TEXT.brandBaseline) - 2),
          fontSize: pt(8.5),
          letterSpacing: pt(3.4),
          lineHeight: 1,
        }}
      >
        ourTailTales
      </p>
    </>
  );
}

function DedicationWords({ meta }: { meta: BookMeta }) {
  const text = meta.dedication.trim();
  // No dedication, no page: pagination leaves it out.
  if (!text) return null;
  const { size, leading } = dedicationType(text);

  return (
    <div
      className="absolute flex items-center justify-center overflow-hidden"
      style={{
        ...boxStyle(DEDICATION_CARD),
        padding: `${pt(30)} ${pt(26)} ${pt(20)}`,
        // Ruled like a note card, one rule per line of words.
        backgroundImage: `repeating-linear-gradient(to bottom, transparent 0, transparent calc(${pt(leading)} - 1px), color-mix(in srgb, var(--bk-accent) 20%, transparent) calc(${pt(leading)} - 1px), color-mix(in srgb, var(--bk-accent) 20%, transparent) ${pt(leading)})`,
        backgroundOrigin: "content-box",
        backgroundClip: "content-box",
        backgroundPosition: `0 calc(50% + ${pt(size * 0.28)})`,
      }}
    >
      <p
        className="w-[80%] text-center italic text-(--bk-ink)"
        style={{
          fontFamily: SERIF,
          fontWeight: 500,
          fontSize: pt(size),
          lineHeight: pt(leading),
        }}
      >
        {text}
      </p>
    </div>
  );
}

function OpenerWords({ chapter }: { chapter: Chapter | undefined }) {
  const box = OPENER_TEXT;
  const blurbLines = openerBlurbLines(chapter);
  return (
    <>
      {chapter ? (
        <div
          aria-hidden
          className="absolute flex items-center justify-center rounded-full bg-(--bk-accent) text-white"
          style={{
            left: pct(OPENER_STICKER.cx - OPENER_STICKER.r),
            top: pct(OPENER_STICKER.cy - OPENER_STICKER.r),
            width: pct(OPENER_STICKER.r * 2),
            height: pct(OPENER_STICKER.r * 2),
            transform: "rotate(-6deg)",
            boxShadow: `${pt(0.8)} ${pt(1.4)} ${pt(2)} rgb(37 42 58 / 0.15)`,
          }}
        >
          <span
            className="absolute rounded-full border border-dashed border-white/70"
            style={{ inset: "7%" }}
          />
          <span
            style={{
              fontFamily: HAND,
              fontWeight: 700,
              fontSize: pt(OPENER_STICKER.r * PAGE_PT * 1.05),
              lineHeight: 1,
            }}
          >
            {chapter.index + 1}
          </span>
        </div>
      ) : null}

      <div
        className="absolute flex flex-col overflow-hidden"
        style={{ ...boxStyle(box) }}
      >
        {chapter?.dateLabel ? (
          <p
            className="text-(--bk-accent)"
            style={{
              fontFamily: HAND,
              fontWeight: 600,
              fontSize: pt(OPENER_TYPE.date),
              lineHeight: 1,
              marginTop: pt(2),
            }}
          >
            {chapter.dateLabel}
          </p>
        ) : null}

        <p
          className="text-(--bk-ink)"
          style={{
            fontFamily: SERIF,
            fontWeight: 600,
            fontSize: pt(OPENER_TYPE.title),
            lineHeight: pt(OPENER_TYPE.titleLeading),
            marginTop: pt(chapter?.dateLabel ? 10 : 4),
            // Clear of the chapter sticker.
            paddingRight: pt(48),
          }}
        >
          {chapter?.title ?? ""}
        </p>

        <p
          className="overflow-hidden text-(--bk-ink-soft)"
          style={{
            fontFamily: SERIF,
            fontWeight: 500,
            fontSize: pt(OPENER_TYPE.blurb),
            lineHeight: pt(OPENER_TYPE.blurbLeading),
            marginTop: pt(8),
            // Ends on an ellipsis, as the PDF does, rather than a half line.
            display: "-webkit-box",
            WebkitBoxOrient: "vertical",
            WebkitLineClamp: blurbLines,
          }}
        >
          {chapter?.blurb ?? ""}
        </p>
      </div>
    </>
  );
}

/**
 * How many blurb lines fit under the title. CSS cannot count wrapped lines
 * ahead of time, so the title's lines are estimated from its length at
 * Cormorant's average character width.
 */
function openerBlurbLines(chapter: Chapter | undefined): number {
  const boxPt = OPENER_TEXT.h * PAGE_PT;
  const titleWidth = OPENER_TEXT.w * PAGE_PT - 48;
  const perLine = Math.max(8, Math.floor(titleWidth / (OPENER_TYPE.title * 0.45)));
  const titleLines = Math.max(1, Math.ceil((chapter?.title.length ?? 0) / perLine));
  const used =
    (chapter?.dateLabel ? OPENER_TYPE.date + 12 : 4) +
    titleLines * OPENER_TYPE.titleLeading +
    8;
  return Math.max(1, Math.floor((boxPt - used) / OPENER_TYPE.blurbLeading));
}

function ImprintWords({ meta }: { meta: BookMeta }) {
  return (
    <div
      className="absolute inset-x-0 flex flex-col items-center text-center text-(--bk-ink-faint)"
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

/* --------------------------------- pieces --------------------------------- */

function Card({ box }: { box: Box }) {
  return (
    <div
      aria-hidden
      className="absolute bg-white"
      style={{ ...boxStyle(box), boxShadow: PRINT_SHADOW }}
    />
  );
}

function PrintView({
  print,
  photos,
  placeholder,
}: {
  print: Print;
  photos: Map<string, PhotoAsset>;
  placeholder: boolean;
}) {
  const window = photoWindow(print);
  const photoId = print.photoId;
  const photo = photoId ? photos.get(photoId) : undefined;
  const url = photoId && !placeholder ? (getFullUrl(photoId) ?? photo?.thumbUrl) : null;
  const inner = {
    left: pct(window.x / print.w),
    top: pct(window.y / print.h),
    width: pct(window.w / print.w),
    height: pct(window.h / print.h),
  };
  const bottomPt = print.bottom * PAGE_PT;
  const captionSize = Math.min(bottomPt * 0.52, 20);

  return (
    <div
      className="absolute bg-white"
      style={{ ...boxStyle(print, print.rotation), boxShadow: PRINT_SHADOW }}
    >
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element -- object-URL of a file the customer just picked
        <img
          src={url}
          alt=""
          draggable={false}
          className="absolute object-cover"
          style={inner}
        />
      ) : (
        <div className="absolute bg-memory-blue/60" style={inner} />
      )}
      {print.caption ? (
        <p
          className="absolute inset-x-0 text-center text-(--bk-ink)/80"
          style={{
            bottom: pt(bottomPt * 0.34 - captionSize * 0.26),
            fontFamily: HAND,
            fontWeight: 600,
            fontSize: pt(captionSize),
            lineHeight: 1,
          }}
        >
          {print.caption}
        </p>
      ) : null}
    </div>
  );
}

const TAPE_CLIP = `polygon(${TAPE_OUTLINE.map(([x, y]) => `${x * 100}% ${y * 100}%`).join(", ")})`;

function TapeView({ tape }: { tape: Tape }) {
  return (
    <div
      aria-hidden
      className="absolute"
      style={{
        ...boxStyle(tape, tape.rotation),
        background: tape.color,
        opacity: tape.opacity,
        clipPath: TAPE_CLIP,
      }}
    />
  );
}

function DoodleView({ doodle }: { doodle: Doodle }) {
  const { d, fill } = DOODLE_PATHS[doodle.kind];
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      className="absolute overflow-visible"
      style={{
        ...boxStyle({ cx: doodle.cx, cy: doodle.cy, w: doodle.size, h: doodle.size }, doodle.rotation),
      }}
    >
      <path
        d={d}
        fill={fill ? doodle.color : "none"}
        fillOpacity={fill ? 0.85 : undefined}
        stroke={fill ? "none" : doodle.color}
        strokeOpacity={0.9}
        strokeWidth={DOODLE_STROKE}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function lifespanText(meta: BookMeta): string {
  const birth = meta.birthYear.trim();
  const death = meta.deathYear.trim();
  if (birth && death) return `${birth}\u2013${death}`;
  return birth || death;
}
