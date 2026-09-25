import { dedicationType, fromPt, heroOf, imprintTexts, lineAt, type BookDesign } from "@/lib/book/design/common";
import {
  emptyDesign,
  flatPrint,
  lifespanText,
  type DesignContext,
  type PageDesign,
  type RectShape,
} from "@/lib/book/design/primitives";
import { SAFE, gridSlots, isPhotoLayout } from "@/lib/book/layouts";
import { CLOSING_LINE } from "@/lib/book/pagination";
import type { BookPage, Slot } from "@/types/book";

/**
 * Modern: the magazine book.
 *
 * Photos run straight off the edge of the page with only a thin white seam
 * between them, and the words are big and graphic — Playfair numerals, tracked
 * capitals, a bar of the book's accent color. Fewer frills, more photograph.
 */

const WHOLE: Slot = { x: 0, y: 0, w: 1, h: 1 };
const SEAM = 0.012;
const GRID = { gutter: SEAM, feature: 0.62, lead: 0.58, framed: { w: 1, h: 0.74, y: 0 } };

/** The accent bar every Modern text page leads with. */
function bar(context: DesignContext, y: number, x = SAFE): RectShape {
  return { kind: "rect", cx: x + 0.045, cy: y, w: 0.09, h: 0.01, rotation: 0, fill: context.palette.accent };
}

function designPage(page: BookPage, context: DesignContext): PageDesign {
  const { palette, meta, chapter } = context;
  const design = emptyDesign(palette.paper);
  const photoId = heroOf(page);

  switch (page.kind) {
    case "title": {
      const years = lifespanText(meta);
      const name = meta.petName.trim() || "Their Story";
      design.prints = [flatPrint({ x: 0, y: 0, w: 1, h: 0.64 }, photoId)];
      design.under = [bar(context, 0.7)];
      design.texts = [
        lineAt({
          baseline: 0.8,
          x: SAFE,
          paragraph: { text: name, font: "displayBold", size: 60, shrinkTo: 28, color: palette.ink },
        }),
        lineAt({
          baseline: 0.93,
          x: SAFE,
          paragraph: { text: "ourTailTales", font: "sans", size: 8.5, tracking: 3.4, color: palette.inkFaint },
        }),
      ];
      if (years) {
        design.texts.push(
          lineAt({
            baseline: 0.855,
            x: SAFE,
            paragraph: { text: years, font: "sansBold", size: 10, tracking: 2.6, color: palette.accent },
          }),
        );
      }
      return design;
    }

    case "dedication": {
      const text = meta.dedication.trim();
      if (!text) return design;
      const { size, leading } = dedicationType(text);
      design.under = [bar(context, 0.3)];
      design.texts = [
        {
          x: SAFE,
          y: 0.34,
          w: 0.72,
          h: 0.5,
          valign: "top",
          paragraphs: [{ text, font: "display", size: size + 1, leading: leading + 2, color: palette.ink }],
        },
      ];
      return design;
    }

    case "chapter-opener": {
      design.prints = [flatPrint({ x: 0, y: 0, w: 1, h: 0.54 }, photoId)];
      if (!chapter) return design;
      design.texts = [
        lineAt({
          baseline: 0.665,
          x: SAFE,
          paragraph: {
            text: String(chapter.index + 1).padStart(2, "0"),
            font: "displayBold",
            size: 64,
            color: palette.accent,
          },
        }),
        {
          x: SAFE,
          y: 0.69,
          w: 1 - SAFE * 2,
          h: 0.245,
          valign: "top",
          paragraphs: [
            {
              text: chapter.dateLabel,
              font: "sansBold",
              size: 8.5,
              leading: 12,
              tracking: 2.6,
              uppercase: true,
              color: palette.inkSoft,
            },
            {
              text: chapter.title,
              font: "displayBold",
              size: 26,
              leading: 30,
              maxLines: 2,
              color: palette.ink,
              gap: 6,
            },
            {
              text: chapter.blurb,
              font: "sans",
              size: 10,
              leading: 15,
              color: palette.inkSoft,
              gap: 8,
              fill: true,
            },
          ],
        },
      ];
      return design;
    }

    case "closing": {
      design.prints = [flatPrint({ x: 0, y: 0, w: 1, h: 0.76 }, photoId)];
      design.under = [bar(context, 0.82)];
      design.texts = [
        lineAt({
          baseline: 0.885,
          x: SAFE,
          paragraph: { text: CLOSING_LINE, font: "displayBold", size: 26, shrinkTo: 18, color: palette.ink },
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

  const slots = gridSlots(page.layoutId, WHOLE, GRID);
  design.prints = page.photoIds.flatMap((id, index) => {
    const slot = slots[index];
    return slot ? [flatPrint(slot, id)] : [];
  });

  if (page.layoutId === "single-framed") {
    // The photo takes the top of the page; the foot is left for its date.
    const caption = page.photoIds[0] ? context.captionOf(page.photoIds[0]) : null;
    design.under = [bar(context, 0.8)];
    if (caption) {
      design.texts = [
        lineAt({
          baseline: 0.8 + fromPt(34),
          x: SAFE,
          paragraph: {
            text: caption,
            font: "sansBold",
            size: 11,
            tracking: 2.6,
            uppercase: true,
            color: context.palette.ink,
          },
        }),
      ];
    }
  }
  return design;
}

export const modern: BookDesign = {
  id: "modern",
  name: "Modern",
  tagline: "Edge-to-edge photos and bold, graphic type.",
  designPage,
};
