import { FACE_METRICS } from "@/lib/book/design/font-metrics";
import {
  PAGE_PT,
  type DesignContext,
  type FontRole,
  type PageDesign,
  type Paragraph,
  type TextBlock,
} from "@/lib/book/design/primitives";
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
