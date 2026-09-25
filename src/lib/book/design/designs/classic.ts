import { dedicationType, fromPt, heroOf, imprintTexts, lineAt, type BookDesign } from "@/lib/book/design/common";
import {
  emptyDesign,
  flatPrint,
  lifespanText,
  numberWord,
  type DesignContext,
  type LineShape,
  type PageDesign,
  type Print,
} from "@/lib/book/design/primitives";
import { gridSlots, isPhotoLayout } from "@/lib/book/layouts";
import { CLOSING_LINE, titlePageHeading } from "@/lib/book/pagination";
import type { BookPage, Slot } from "@/types/book";
import type { Orientation } from "@/types/photo";

/**
 * Classic: the gallery book.
 *
 * Photos sit perfectly straight on generous white space with a hairline
 * around them, singles run to the edge of the page, and the words are set in
 * centred Cormorant with small tracked capitals and thin rules — the quiet,
 * timeless look of a lay-flat wedding album.
 */

const MARGIN = 0.1;
const FRAME: Slot = { x: MARGIN, y: MARGIN, w: 1 - MARGIN * 2, h: 1 - MARGIN * 2 };
const GRID = { gutter: 0.028, feature: 0.62, lead: 0.56, framed: { w: 0.8, h: 0.78, y: 0.02 } };

function keyline(context: DesignContext): Print["keyline"] {
  return { color: context.palette.ink, width: 0.5, opacity: 0.28 };
}

function framedPrint(rect: Slot, photoId: string | undefined, context: DesignContext): Print {
  return flatPrint(rect, photoId, { keyline: keyline(context) });
}

/** A rectangle of a photo's own shape, centred in `area`. */
function fitted(area: Slot, orientation: Orientation | undefined): Slot {
  const aspect = orientation === "portrait" ? 3 / 4 : orientation === "square" ? 1 : 4 / 3;
  let w = area.w;
  let h = w / aspect;
  if (h > area.h) {
    h = area.h;
    w = h * aspect;
  }
  return { x: area.x + (area.w - w) / 2, y: area.y + (area.h - h) / 2, w, h };
}

function rule(cy: number, half: number, context: DesignContext): LineShape {
  return {
    kind: "line",
    x1: 0.5 - half,
    y1: cy,
    x2: 0.5 + half,
    y2: cy,
    color: context.palette.accent,
    width: 0.75,
    opacity: 0.7,
  };
}

function designPage(page: BookPage, context: DesignContext): PageDesign {
  const { palette, meta, chapter } = context;
  const design = emptyDesign(palette.paper);
  const photoId = heroOf(page);
  const orientation = photoId ? context.orientationOf(photoId) : undefined;

  switch (page.kind) {
    case "title": {
      const years = lifespanText(meta);
      design.prints = [framedPrint(fitted({ x: 0.2, y: 0.4, w: 0.6, h: 0.44 }, orientation), photoId, context)];
      design.under = [rule(0.335, 0.035, context)];
      design.texts = [
        lineAt({
          baseline: 0.235,
          x: 0.1,
          paragraph: {
            text: titlePageHeading(meta.petName),
            font: "serif",
            size: 54,
            shrinkTo: 28,
            color: palette.ink,
            align: "center",
          },
        }),
        lineAt({
          baseline: 0.93,
          paragraph: { text: "ourTailTales", font: "sans", size: 8.5, tracking: 3.4, color: palette.inkFaint, align: "center" },
        }),
      ];
      if (years) {
        design.texts.push(
          lineAt({
            baseline: 0.3,
            paragraph: {
              text: years,
              font: "sans",
              size: 9,
              tracking: 3,
              uppercase: true,
              color: palette.inkSoft,
              align: "center",
            },
          }),
        );
      }
      return design;
    }

    case "dedication": {
      const text = meta.dedication.trim();
      if (!text) return design;
      const { size, leading } = dedicationType(text);
      design.under = [rule(0.27, 0.03, context), rule(0.73, 0.03, context)];
      design.texts = [
        {
          x: 0.18,
          y: 0.3,
          w: 0.64,
          h: 0.4,
          valign: "middle",
          paragraphs: [{ text, font: "serifItalic", size, leading, color: palette.ink, align: "center" }],
        },
      ];
      return design;
    }

    case "chapter-opener": {
      design.prints = [framedPrint(fitted({ x: 0.14, y: 0.5, w: 0.72, h: 0.4 }, "landscape"), photoId, context)];
      if (!chapter) return design;
      design.texts = [
        {
          x: 0.14,
          y: 0.1,
          w: 0.72,
          h: 0.35,
          valign: "top",
          paragraphs: [
            {
              text: `Chapter ${numberWord(chapter.index + 1)}`,
              font: "sans",
              size: 8.5,
              leading: 12,
              tracking: 3,
              uppercase: true,
              color: palette.accent,
              align: "center",
            },
            {
              text: chapter.title,
              font: "serifBold",
              size: 32,
              leading: 35,
              maxLines: 2,
              color: palette.ink,
              align: "center",
              gap: 12,
            },
            {
              text: chapter.dateLabel,
              font: "serifItalic",
              size: 15,
              leading: 19,
              color: palette.inkSoft,
              align: "center",
              gap: 4,
            },
            {
              text: chapter.blurb,
              font: "serif",
              size: 13.5,
              leading: 19,
              color: palette.inkSoft,
              align: "center",
              gap: 12,
              fill: true,
            },
          ],
        },
      ];
      return design;
    }

    case "closing": {
      design.prints = [framedPrint(fitted({ x: 0.14, y: 0.1, w: 0.72, h: 0.64 }, orientation), photoId, context)];
      design.under = [rule(0.815, 0.03, context)];
      design.texts = [
        lineAt({
          baseline: 0.875,
          paragraph: { text: CLOSING_LINE, font: "serifItalic", size: 24, color: palette.ink, align: "center" },
        }),
      ];
      return design;
    }

    case "imprint":
      design.texts = imprintTexts(context);
      return design;

    default:
      return photoPage(page, context, design);
  }
}

function photoPage(page: BookPage, context: DesignContext, design: PageDesign): PageDesign {
  if (!isPhotoLayout(page.layoutId) || page.photoIds.length === 0) return design;

  if (page.layoutId === "full-bleed") {
    // The one place Classic lets a photo off the leash: a single, edge to edge.
    design.prints = [flatPrint({ x: 0, y: 0, w: 1, h: 1 }, page.photoIds[0])];
    return design;
  }

  const slots = gridSlots(page.layoutId, FRAME, GRID);
  design.prints = page.photoIds.flatMap((id, index) => {
    const slot = slots[index];
    return slot ? [framedPrint(slot, id, context)] : [];
  });

  if (page.layoutId === "single-framed") {
    const photo = design.prints[0];
    const caption = page.photoIds[0] ? context.captionOf(page.photoIds[0]) : null;
    if (photo && caption) {
      design.texts = [
        lineAt({
          baseline: photo.cy + photo.h / 2 + fromPt(28),
          paragraph: { text: caption, font: "serifItalic", size: 14, color: context.palette.inkSoft, align: "center" },
        }),
      ];
    }
  }
  return design;
}

export const classic: BookDesign = {
  id: "classic",
  name: "Classic",
  tagline: "Clean white space, straight lines, timeless type.",
  designPage,
};
