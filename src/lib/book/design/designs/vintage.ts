import { dedicationType, fromPt, heroOf, imprintTexts, lineAt, type BookDesign } from "@/lib/book/design/common";
import {
  between,
  emptyDesign,
  keepOnPage,
  lifespanText,
  romanNumeral,
  seededRandom,
  type DesignContext,
  type PageDesign,
  type Print,
  type Shape,
} from "@/lib/book/design/primitives";
import { gridSlots, isPhotoLayout } from "@/lib/book/layouts";
import { CLOSING_LINE, titlePageHeading } from "@/lib/book/pagination";
import { mixHex } from "@/lib/book/palette";
import type { BookPage, Slot } from "@/types/book";
import type { Orientation } from "@/types/photo";

/**
 * Vintage: the family album.
 *
 * Warm cream paper inside a thin double rule, each photo a bordered print
 * held down by four dark photo corners and set just off true, captions in
 * italic, and a small flourish between the words — the album a grandparent
 * keeps in the bottom drawer.
 */

const MARGIN = 0.105;
const FRAME: Slot = { x: MARGIN, y: MARGIN, w: 1 - MARGIN * 2, h: 1 - MARGIN * 2 };
const GRID = { gutter: 0.036, feature: 0.6, lead: 0.56, framed: { w: 0.78, h: 0.74, y: 0.02 } };

/** Photos stay inside the page's rule. */
const EDGE = 0.075;

/** The book's paper, warmed toward an old album page. */
function paperOf(context: DesignContext): string {
  return mixHex(context.palette.paper, "#efe2c8", 0.6);
}

function borderOf(context: DesignContext): string {
  return mixHex(context.palette.paper, "#fffdf7", 0.7);
}

/** A thin double rule around the page. */
function pageRule(context: DesignContext): Shape[] {
  const color = context.palette.inkSoft;
  return [
    { kind: "rect", cx: 0.5, cy: 0.5, w: 0.89, h: 0.89, rotation: 0, stroke: { color, width: 0.8, opacity: 0.35 } },
    { kind: "rect", cx: 0.5, cy: 0.5, w: 0.874, h: 0.874, rotation: 0, stroke: { color, width: 0.4, opacity: 0.3 } },
  ];
}

/** Line — diamond — line, centred at `cy`. */
function flourish(cy: number, context: DesignContext, half = 0.07): Shape[] {
  const color = context.palette.accent;
  return [
    { kind: "line", x1: 0.5 - half, y1: cy, x2: 0.5 - 0.016, y2: cy, color, width: 0.6, opacity: 0.8 },
    { kind: "rect", cx: 0.5, cy, w: 0.011, h: 0.011, rotation: 45, fill: color, opacity: 0.85 },
    { kind: "line", x1: 0.5 + 0.016, y1: cy, x2: 0.5 + half, y2: cy, color, width: 0.6, opacity: 0.8 },
  ];
}

/**
 * A bordered print filling `slot`, tilted a touch, with photo corners. A deep
 * bottom border carries the date where there is room to write one.
 */
function albumPrint(args: {
  slot: Slot;
  photoId: string | undefined;
  context: DesignContext;
  random: () => number;
  captioned: boolean;
  tilt?: number;
}): Print {
  const { slot, context, random } = args;
  const inset = Math.min(slot.w, slot.h) * 0.04;
  const w = slot.w - inset * 2;
  const h = slot.h - inset * 2;
  const side = Math.min(Math.max(Math.min(w, h) * 0.04, 0.01), 0.018);
  const caption = args.captioned && args.photoId ? context.captionOf(args.photoId) : null;
  const bottom = caption ? side * 2.8 : side;
  const base = keepOnPage(
    {
      cx: slot.x + slot.w / 2,
      cy: slot.y + slot.h / 2,
      w,
      h,
      rotation: args.tilt ?? (random() < 0.5 ? -1 : 1) * between(random, 0.3, 1.1),
    },
    EDGE,
  );
  return {
    ...base,
    side,
    bottom,
    border: borderOf(context),
    shadow: true,
    photoId: args.photoId,
    caption,
    captionFont: "serifItalic",
    captionColor: context.palette.inkSoft,
    tapes: [],
    corners: { color: context.palette.ink, opacity: 0.82, size: Math.min(Math.max(Math.min(w, h) * 0.12, 0.022), 0.04) },
  };
}

/** A slot of a photo's own shape, centred in `area`. */
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

function designPage(page: BookPage, context: DesignContext): PageDesign {
  const { palette, meta, chapter } = context;
  const random = seededRandom(`vintage:${page.id}`);
  const design = emptyDesign(paperOf(context));
  design.under = pageRule(context);
  const photoId = heroOf(page);
  const orientation = photoId ? context.orientationOf(photoId) : undefined;

  switch (page.kind) {
    case "title": {
      const years = lifespanText(meta);
      design.under.push(...flourish(0.255, context));
      design.prints = [
        albumPrint({
          slot: fitted({ x: 0.2, y: 0.36, w: 0.6, h: 0.48 }, orientation),
          photoId,
          context,
          random,
          captioned: false,
          tilt: -1.2,
        }),
      ];
      design.texts = [
        lineAt({
          baseline: 0.215,
          x: 0.12,
          paragraph: {
            text: titlePageHeading(meta.petName),
            font: "serifItalic",
            size: 58,
            shrinkTo: 28,
            color: palette.ink,
            align: "center",
          },
        }),
        lineAt({
          baseline: 0.905,
          paragraph: { text: "ourTailTales", font: "serifItalic", size: 12, color: palette.inkFaint, align: "center" },
        }),
      ];
      if (years) {
        design.texts.push(
          lineAt({
            baseline: 0.31,
            paragraph: {
              text: years,
              font: "serif",
              size: 13,
              tracking: 2.5,
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
      design.under.push(...flourish(0.28, context), ...flourish(0.72, context));
      design.texts = [
        {
          x: 0.18,
          y: 0.31,
          w: 0.64,
          h: 0.38,
          valign: "middle",
          paragraphs: [{ text, font: "serifItalic", size: size + 1, leading, color: palette.ink, align: "center" }],
        },
      ];
      return design;
    }

    case "chapter-opener": {
      design.prints = [
        albumPrint({
          slot: fitted({ x: 0.16, y: 0.5, w: 0.68, h: 0.38 }, "landscape"),
          photoId,
          context,
          random,
          captioned: false,
        }),
      ];
      if (!chapter) return design;
      design.texts = [
        {
          x: 0.15,
          y: 0.1,
          w: 0.7,
          h: 0.355,
          valign: "top",
          paragraphs: [
            {
              text: `Chapter ${romanNumeral(chapter.index + 1)}`,
              font: "serifItalic",
              size: 20,
              leading: 24,
              color: palette.accent,
              align: "center",
            },
            {
              text: chapter.title,
              font: "display",
              size: 28,
              leading: 33,
              maxLines: 2,
              color: palette.ink,
              align: "center",
              gap: 8,
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
              gap: 10,
              fill: true,
            },
          ],
        },
      ];
      return design;
    }

    case "closing": {
      design.prints = [
        albumPrint({
          slot: fitted({ x: 0.16, y: 0.12, w: 0.68, h: 0.6 }, orientation),
          photoId,
          context,
          random,
          captioned: false,
          tilt: 1,
        }),
      ];
      design.under.push(...flourish(0.9, context, 0.05));
      design.texts = [
        lineAt({
          baseline: 0.845,
          paragraph: { text: CLOSING_LINE, font: "serifItalic", size: 26, color: palette.ink, align: "center" },
        }),
      ];
      return design;
    }

    case "imprint":
      design.texts = imprintTexts(context, { font: "serifItalic", size: 11, top: 0.76 });
      return design;

    default: {
      if (!isPhotoLayout(page.layoutId) || page.photoIds.length === 0) return design;
      const captioned = page.photoIds.length <= 2;
      const slots = gridSlots(page.layoutId, FRAME, GRID);
      design.prints = page.photoIds.flatMap((id, index) => {
        const slot = slots[index];
        if (!slot) return [];
        // A single photo keeps its own shape rather than being cropped to the page.
        const area = page.layoutId === "full-bleed" || page.layoutId === "single-framed"
          ? fitted(slot, context.orientationOf(id))
          : slot;
        return [albumPrint({ slot: area, photoId: id, context, random, captioned })];
      });
      if (page.layoutId === "single-framed") {
        const photo = design.prints[0];
        if (photo) design.under.push(...flourish(photo.cy + photo.h / 2 + fromPt(34), context, 0.06));
      }
      return design;
    }
  }
}

export const vintage: BookDesign = {
  id: "vintage",
  name: "Vintage",
  tagline: "Cream paper, photo corners, a family-album feel.",
  designPage,
};
