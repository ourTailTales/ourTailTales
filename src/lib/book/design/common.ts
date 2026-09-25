import { FACE_METRICS } from "@/lib/book/design/font-metrics";
import {
  PAGE_PT,
  type DesignContext,
  type FontRole,
  type PageDesign,
  type Paragraph,
  type TextBlock,
} from "@/lib/book/design/primitives";
import { layoutTextBlock } from "@/lib/book/design/text";
import { isPhotoLayout, layoutNoteCount } from "@/lib/book/layouts";
import { possessivePetName } from "@/lib/book/pagination";
import type { BookPage, DesignId } from "@/types/book";

/**
 * A book design: how every kind of page looks.
 *
 * Designs are pure functions of the page and the book. They never see a
 * renderer, a font file or the DOM, which is what lets the same design draw
 * the filmstrip thumbnail, the editor viewport and the 300ppi print file.
 */
export type BookDesign = {
  id: DesignId;
  name: string;
  /** One line for the design picker. */
  tagline: string;
  designPage: (page: BookPage, context: DesignContext) => PageDesign;
};

/** Normalized → points. */
export function toPt(value: number): number {
  return value * PAGE_PT;
}

/** Points → normalized. */
export function fromPt(value: number): number {
  return value / PAGE_PT;
}

/**
 * One line of words whose baseline sits at `baseline` (normalized, from the
 * top), across `x`..`x + w`. The block is exactly one line tall so the
 * baseline lands where asked in both renderers.
 */
export function lineAt(args: {
  baseline: number;
  x?: number;
  w?: number;
  rotation?: number;
  paragraph: Omit<Paragraph, "leading">;
}): TextBlock {
  const { paragraph } = args;
  const metrics = FACE_METRICS[paragraph.font];
  const content = (metrics.ascent + metrics.descent) * paragraph.size;
  const x = args.x ?? 0;
  return {
    x,
    y: args.baseline - fromPt(metrics.ascent * paragraph.size),
    w: args.w ?? 1 - x * 2,
    h: fromPt(content),
    valign: "top",
    rotation: args.rotation,
    paragraphs: [{ ...paragraph, leading: content }],
  };
}

/** The imprint's three quiet lines, centred near the foot of the page. */
export function imprintTexts(
  context: DesignContext,
  options: { font?: FontRole; size?: number; color?: string; top?: number } = {},
): TextBlock[] {
  const color = options.color ?? context.palette.inkFaint;
  const font = options.font ?? "sans";
  const size = options.size ?? 9;
  const top = options.top ?? 0.78;
  return [
    lineAt({
      baseline: top,
      paragraph: { text: "ourTailTales", font: "sans", size: 9, tracking: 3.4, color, align: "center" },
    }),
    lineAt({
      baseline: top + fromPt(31.5),
      paragraph: {
        text: `Made from ${possessivePetName(context.meta.petName)} own photographs.`,
        font,
        size,
        color,
        align: "center",
      },
    }),
    lineAt({
      baseline: top + fromPt(31.5 + size * 1.55),
      paragraph: { text: "Printed and bound on demand.", font, size, color, align: "center" },
    }),
  ];
}

/** Dedication type size, stepping down for a long one. */
export function dedicationType(text: string): { size: number; leading: number } {
  const size = text.length > 180 ? 17 : 21;
  return { size, leading: Math.round(size * 1.55) };
}

/** The page's hero photo, if it has one. */
export function heroOf(page: BookPage): string | undefined {
  return page.photoIds[0];
}

/* ------------------------------ page notes ------------------------------ */

/**
 * What a caption layout's note slot has to say.
 *
 * Three deep, and the first one that exists wins: the owner's own words, then
 * the line written for this page when the chapter was written, then the month
 * its photographs were taken. Under all of it sits the date and, once per
 * page, the place — so a page always has something true to say, and the
 * owner's own words always come first.
 */
export type PageNote = {
  /** The owner's words, or null. */
  text: string | null;
  /** "June 2019", from the photograph on this page, or the chapter's own line. */
  date: string | null;
  /** "Lake Tahoe" — only ever on a page's first note. */
  place: string | null;
};

/** The notes a page carries, one per slot its layout keeps room for. */
export function pageNotes(page: BookPage, context: DesignContext): PageNote[] {
  const slots = isPhotoLayout(page.layoutId) ? layoutNoteCount(page.layoutId) : 0;
  if (slots === 0) return [];

  return Array.from({ length: slots }, (_, index) => {
    const written = page.notes?.[index];
    // Two notes on a page of two photographs belong one to each.
    const photoId = slots === page.photoIds.length ? page.photoIds[index] : page.photoIds[0];
    const date = (photoId ? context.captionOf(photoId) : null) ?? chapterDate(context);
    const own = typeof written === "string" && written.trim() ? written.trim() : null;
    // The written-for-you line goes on the page's first note only: on a page
    // of two, the second photograph keeps its own date rather than repeating
    // a line about the pair.
    const given = index === 0 && page.caption?.trim() ? page.caption.trim() : null;
    return {
      text: own ?? given,
      date,
      place: index === 0 && slots === 1 ? placeLabel(context) : null,
    };
  });
}

function chapterDate(context: DesignContext): string | null {
  const label = context.chapter?.dateLabel.trim();
  return label ? label : null;
}

function placeLabel(context: DesignContext): string | null {
  const place = context.chapter?.places[0];
  if (!place) return null;
  return place.city || place.region || place.country || null;
}

/** True for a note with nothing at all to print. */
export function isEmptyNote(note: PageNote): boolean {
  return !note.text && !note.date && !note.place;
}

export type NoteStyle = {
  /** The owner's words. */
  body: { font: FontRole; size: number; leading?: number; color: string; maxLines?: number };
  /** The date line, and the place beside it. */
  meta: { font: FontRole; size: number; color: string; tracking?: number; uppercase?: boolean };
  /** The date on its own, when there are no words to head. */
  alone?: { font: FontRole; size: number; color: string };
  align?: "left" | "center" | "right";
};

/**
 * One note, set as paragraphs: the owner's words with the date under them,
 * or — when they wrote none — the date alone, set larger, the way a date is
 * written on an album page rather than filed under a caption.
 */
export function noteParagraphs(note: PageNote, style: NoteStyle): Paragraph[] {
  const align = style.align ?? "left";
  const meta = [note.date, note.place].filter(Boolean).join("  ·  ");

  if (!note.text) {
    if (!meta) return [];
    const alone = style.alone ?? { font: style.body.font, size: style.body.size, color: style.body.color };
    return [{ text: meta, font: alone.font, size: alone.size, color: alone.color, align }];
  }

  const paragraphs: Paragraph[] = [
    {
      text: note.text,
      font: style.body.font,
      size: style.body.size,
      leading: style.body.leading,
      color: style.body.color,
      align,
      maxLines: style.body.maxLines,
      // Takes the room the block has and no more: a long note on a shallow
      // band ends on an ellipsis rather than running across the photographs.
      fill: true,
    },
  ];
  if (meta) {
    paragraphs.push({
      text: meta,
      font: style.meta.font,
      size: style.meta.size,
      color: style.meta.color,
      tracking: style.meta.tracking,
      uppercase: style.meta.uppercase,
      align,
      gap: style.body.size * 0.75,
    });
  }
  return paragraphs;
}

/** How tall the words in a block actually stand, normalized. */
export function textHeight(block: TextBlock): number {
  return fromPt(layoutTextBlock(block).used);
}
