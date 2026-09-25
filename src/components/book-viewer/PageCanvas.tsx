"use client";

import { useMemo, type CSSProperties } from "react";

import { CoverFrontArt, coverImageUrl } from "@/components/book-viewer/CoverArt";
import { designContext, designPage } from "@/lib/book/design";
import {
  DEFAULT_CAPTION_COLOR,
  DOODLE_PATHS,
  DOODLE_STROKE,
  PAGE_PT,
  TAPE_OUTLINE,
  cornerTriangles,
  photoWindow,
  type Box,
  type Doodle,
  type FontRole,
  type Print,
  type Shape,
  type Tape,
  type TextBlock,
} from "@/lib/book/design/primitives";
import { faceMetrics, layoutTextBlock } from "@/lib/book/design/text";
import { BLEED_INCHES, PAGE_INCHES, TRIM_INCHES } from "@/lib/book/layouts";
import { getFullUrl } from "@/lib/photo/assetStore";
import type { BookMeta, BookPage, Chapter } from "@/types/book";
import type { PhotoAsset } from "@/types/photo";

/**
 * One page of the book, drawn in the browser.
 *
 * It draws the page's design (`lib/book/design`) — the same primitives, in
 * the same order, that the print renderer draws — so what a customer sees
 * here is what gets bound, in whichever design the book is set in. Sizes are
 * expressed as a share of the page width in `cqw`, which makes one component
 * correct at every size it is used at — a 72px filmstrip thumbnail and a
 * 700px editor viewport are the same markup at two container widths.
 *
 * Crucially this renders from the book's *data*, not from the PDF. An edit
 * shows up on the next React render rather than after a round trip through a
 * renderer, which is what makes the editor feel like an editor.
 */

/** Page-space point → a share of the container width. */
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

/* ------------------------------- the page ------------------------------- */

/**
 * The web face for each of a design's font roles — the same families and
 * weights the PDF embeds. Sans is Helvetica on both, rather than the site's
 * Inter, so a Modern page measures the same on screen as on paper.
 */
const FACES: Record<FontRole, CSSProperties> = {
  hand: { fontFamily: "var(--font-caveat)", fontWeight: 600 },
  handBold: { fontFamily: "var(--font-caveat)", fontWeight: 700 },
  serif: { fontFamily: "var(--font-cover)", fontWeight: 500 },
  serifItalic: { fontFamily: "var(--font-cover)", fontWeight: 500, fontStyle: "italic" },
  serifBold: { fontFamily: "var(--font-cover)", fontWeight: 600 },
  display: { fontFamily: "var(--font-playfair)", fontWeight: 400 },
  displayBold: { fontFamily: "var(--font-playfair)", fontWeight: 700 },
  sans: { fontFamily: 'Helvetica, Arial, "Liberation Sans", sans-serif', fontWeight: 400 },
  sansBold: { fontFamily: 'Helvetica, Arial, "Liberation Sans", sans-serif', fontWeight: 700 },
};

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
  const design = useMemo(
    () => designPage(page, designContext({ meta, chapter, photos })),
    [page, meta, chapter, photos],
  );

  return (
    <div className="absolute inset-0" style={{ background: design.paper }}>
      {design.under.map((shape, index) => (
        <ShapeView key={`under-${index}`} shape={shape} />
      ))}

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
      {design.prints.flatMap((print, index) => [
        ...print.tapes.map((tape, tapeIndex) => (
          <TapeView key={`tape-${index}-${tapeIndex}`} tape={tape} />
        )),
        print.corners ? <CornersView key={`corners-${index}`} print={print} /> : null,
      ])}

      {design.over.map((shape, index) => (
        <ShapeView key={`over-${index}`} shape={shape} />
      ))}

      {design.doodles.map((doodle, index) => (
        <DoodleView key={`doodle-${index}`} doodle={doodle} />
      ))}

      {design.texts.map((block, index) => (
        <TextBlockView key={`text-${index}`} block={block} />
      ))}
    </div>
  );
}

/* --------------------------------- pieces --------------------------------- */

function ShapeView({ shape }: { shape: Shape }) {
  switch (shape.kind) {
    case "rect":
      return (
        <div
          aria-hidden
          className="absolute"
          style={{
            ...boxStyle(shape, shape.rotation),
            background: shape.fill,
            opacity: shape.fill ? (shape.opacity ?? 1) : undefined,
            boxShadow: shape.shadow ? PRINT_SHADOW : undefined,
            outline: shape.stroke
              ? `${pt(shape.stroke.width)} solid color-mix(in srgb, ${shape.stroke.color} ${(shape.stroke.opacity ?? 1) * 100}%, transparent)`
              : undefined,
            outlineOffset: shape.stroke ? pt(-shape.stroke.width / 2) : undefined,
          }}
        />
      );
    case "circle":
      return (
        <div
          aria-hidden
          className="absolute rounded-full"
          style={{
            left: pct(shape.cx - shape.r),
            top: pct(shape.cy - shape.r),
            width: pct(shape.r * 2),
            height: pct(shape.r * 2),
            background: shape.fill
              ? `color-mix(in srgb, ${shape.fill} ${(shape.opacity ?? 1) * 100}%, transparent)`
              : undefined,
            boxShadow: shape.shadow ? `${pt(0.8)} ${pt(1.4)} ${pt(2)} rgb(37 42 58 / 0.15)` : undefined,
            border: shape.stroke
              ? `${pt(shape.stroke.width)} ${shape.stroke.dash ? "dashed" : "solid"} color-mix(in srgb, ${shape.stroke.color} ${(shape.stroke.opacity ?? 1) * 100}%, transparent)`
              : undefined,
          }}
        />
      );
    case "line": {
      const x = shape.x1;
      const y = shape.y1;
      const length = Math.hypot(shape.x2 - x, shape.y2 - y);
      const angle = (Math.atan2(shape.y2 - y, shape.x2 - x) * 180) / Math.PI;
      return (
        <div
          aria-hidden
          className="absolute origin-left"
          style={{
            left: pct(x),
            top: `calc(${pct(y)} - ${pt(shape.width / 2)})`,
            width: pct(length),
            height: pt(shape.width),
            background: shape.color,
            opacity: shape.opacity ?? 1,
            transform: angle ? `rotate(${angle}deg)` : undefined,
          }}
        />
      );
    }
    case "tape":
      return <TapeView tape={shape} />;
  }
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
  const bordered = print.side > 0 || print.bottom > 0;

  return (
    <div
      className="absolute"
      style={{
        ...boxStyle(print, print.rotation),
        background: bordered ? print.border : undefined,
        boxShadow: print.shadow ? PRINT_SHADOW : undefined,
      }}
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
      {print.keyline ? (
        <div
          aria-hidden
          className="absolute"
          style={{
            ...inner,
            boxShadow: `inset 0 0 0 ${pt(print.keyline.width)} color-mix(in srgb, ${print.keyline.color} ${print.keyline.opacity * 100}%, transparent)`,
          }}
        />
      ) : null}
      {print.caption ? (
        <p
          className="absolute inset-x-0 whitespace-nowrap text-center"
          style={{
            ...FACES[print.captionFont ?? "hand"],
            bottom: pt(bottomPt * 0.34 - captionSize * 0.26),
            color: print.captionColor ?? DEFAULT_CAPTION_COLOR,
            opacity: 0.8,
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

function CornersView({ print }: { print: Print }) {
  const corners = print.corners!;
  return (
    <svg
      aria-hidden
      viewBox={`0 0 ${print.w} ${print.h}`}
      preserveAspectRatio="none"
      className="absolute overflow-visible"
      style={boxStyle(print, print.rotation)}
    >
      {cornerTriangles(print).map((triangle, index) => (
        <polygon
          key={index}
          points={triangle.map(([x, y]) => `${x},${y}`).join(" ")}
          fill={corners.color}
          fillOpacity={corners.opacity}
        />
      ))}
    </svg>
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
  const { d, fill: filledByDefault } = DOODLE_PATHS[doodle.kind];
  const filled = doodle.fill ?? filledByDefault;
  // A filled doodle with an outline is a sticker: the edge is drawn around
  // the shape, which is what lifts it off the page.
  const stroke = doodle.outline ?? (filled ? null : doodle.color);
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      className="absolute overflow-visible"
      style={{
        ...boxStyle({ cx: doodle.cx, cy: doodle.cy, w: doodle.size, h: doodle.size }, doodle.rotation),
        filter: doodle.outline ? `drop-shadow(0 ${pt(0.5)} ${pt(1.2)} rgb(37 42 58 / 0.22))` : undefined,
      }}
    >
      <path
        d={d}
        fill={filled ? doodle.color : "none"}
        fillOpacity={filled ? (doodle.outline ? 1 : 0.85) : undefined}
        stroke={stroke ?? "none"}
        strokeOpacity={doodle.outline ? 1 : 0.9}
        strokeWidth={doodle.outline ? DOODLE_STROKE * 1.6 : DOODLE_STROKE}
        strokeLinecap="round"
        strokeLinejoin="round"
        paintOrder={doodle.outline ? "stroke" : undefined}
      />
    </svg>
  );
}

/**
 * The lines `layoutTextBlock` laid out, each placed on its own baseline. The
 * browser never wraps book text itself — that is what keeps a line break on
 * screen where it falls in print.
 */
function TextBlockView({ block }: { block: TextBlock }) {
  const laid = useMemo(() => layoutTextBlock(block), [block]);
  if (laid.lines.length === 0) return null;

  return (
    <div
      className="absolute"
      style={{
        left: pt(laid.left),
        top: pt(laid.top),
        width: pt(laid.width),
        height: pt(laid.height),
        transform: laid.rotation ? `rotate(${laid.rotation}deg)` : undefined,
      }}
    >
      {laid.rules.map((rule, index) => (
        <div
          key={`rule-${index}`}
          aria-hidden
          className="absolute"
          style={{
            left: pt(rule.x1),
            width: pt(rule.x2 - rule.x1),
            top: pt(rule.y - 0.25),
            height: pt(0.5),
            background: rule.color,
            opacity: rule.opacity,
          }}
        />
      ))}
      {laid.pills.map((pill, index) => (
        <div
          key={`pill-${index}`}
          aria-hidden
          className="absolute rounded-full"
          style={{
            left: pt(pill.cx - pill.w / 2),
            top: pt(pill.cy - pill.h / 2),
            width: pt(pill.w),
            height: pt(pill.h),
            border: `${pt(1)} solid color-mix(in srgb, ${pill.color} ${pill.opacity * 100}%, transparent)`,
          }}
        />
      ))}
      {laid.lines.map((line, index) => {
        const metrics = faceMetrics(line.font);
        const content = (metrics.ascent + metrics.descent) * line.size;
        return (
          <p
            key={`line-${index}`}
            className="absolute whitespace-pre"
            style={{
              ...FACES[line.font],
              left: pt(line.left),
              width: pt(line.width),
              top: pt(line.baseline - metrics.ascent * line.size),
              height: pt(content),
              fontSize: pt(line.size),
              lineHeight: pt(content),
              letterSpacing: line.tracking ? pt(line.tracking) : undefined,
              // Letter-spacing trails the last letter too; give it back so
              // tracked capitals centre where the PDF centres them.
              textIndent: line.tracking && line.align === "center" ? pt(line.tracking) : undefined,
              textAlign: line.align,
              color: line.color,
              opacity: line.opacity,
              fontKerning: "none",
            }}
          >
            {line.text}
          </p>
        );
      })}
    </div>
  );
}
