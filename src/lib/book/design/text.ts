import { FACE_METRICS, FALLBACK_WIDTH, MEASURED_CHARS } from "@/lib/book/design/font-metrics";
import { PAGE_PT, type FontRole, type Paragraph, type TextBlock } from "@/lib/book/design/primitives";

/**
 * Lays a text block out into lines, once, for both renderers.
 *
 * The browser and pdf-lib wrap text differently, and a chapter blurb that
 * breaks after "the" on screen and before it on paper is how an edited book
 * stops matching its proof. So neither of them wraps: this does, measuring
 * with the fonts' own advance widths (`font-metrics.ts`), and both renderers
 * draw exactly the lines it returns, at exactly the baselines it returns.
 *
 * Everything here is in points on the 630pt bleed page, y running down.
 */

const INDEX = new Map([...MEASURED_CHARS].map((character, index) => [character, index]));

export function faceMetrics(font: FontRole) {
  return FACE_METRICS[font];
}

/** Width of a run of text, in points. */
export function measure(text: string, font: FontRole, size: number, tracking = 0): number {
  const widths = FACE_METRICS[font].widths;
  let units = 0;
  let count = 0;
  for (const character of text) {
    const index = INDEX.get(character);
    units += index === undefined ? FALLBACK_WIDTH : widths[index]!;
    count += 1;
  }
  return (units / 1000) * size + tracking * Math.max(0, count - 1);
}

/** Greedy word wrap. A single word wider than the line is left to overflow. */
export function wrap(
  text: string,
  font: FontRole,
  size: number,
  maxWidth: number,
  tracking = 0,
): string[] {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return [];
  const lines: string[] = [];
  let current = "";
  for (const word of clean.split(" ")) {
    const candidate = current ? `${current} ${word}` : word;
    if (!current || measure(candidate, font, size, tracking) <= maxWidth) {
      current = candidate;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

/**
 * At most `room` lines; if the text is cut, the last line ends on an
 * ellipsis at a word boundary rather than stopping mid-sentence.
 */
export function fitLines(
  lines: string[],
  room: number,
  font: FontRole,
  size: number,
  maxWidth: number,
  tracking = 0,
): string[] {
  if (lines.length <= room) return lines;
  if (room <= 0) return [];
  const kept = lines.slice(0, room);
  let last = kept[room - 1]!;
  while (last.includes(" ") && measure(`${last}…`, font, size, tracking) > maxWidth) {
    last = last.replace(/\s*\S+$/, "");
  }
  kept[room - 1] = `${last.replace(/[\s,;:—–-]+$/, "")}…`;
  return kept;
}

export type LaidLine = {
  text: string;
  font: FontRole;
  size: number;
  color: string;
  opacity: number;
  tracking: number;
  align: "left" | "center" | "right";
  /** The line's box, points from the block's own top-left. */
  left: number;
  width: number;
  /** Points from the block's top. */
  baseline: number;
  /** The words' measured width, points. */
  textWidth: number;
};

export type LaidPill = {
  /** Centre and size, points from the block's top-left. */
  cx: number;
  cy: number;
  w: number;
  h: number;
  color: string;
  opacity: number;
};

export type LaidRule = { x1: number; x2: number; y: number; color: string; opacity: number };

export type LaidOutBlock = {
  /** The block's box on the page, points. */
  left: number;
  top: number;
  width: number;
  height: number;
  rotation: number;
  /** How much of the block's height the words actually take, points. */
  used: number;
  lines: LaidLine[];
  pills: LaidPill[];
  rules: LaidRule[];
};

type Measured = {
  paragraph: Paragraph;
  text: string;
  size: number;
  leading: number;
  lines: string[];
  maxWidth: number;
};

export function layoutTextBlock(block: TextBlock): LaidOutBlock {
  const width = block.w * PAGE_PT;
  const height = block.h * PAGE_PT;

  const measured: Measured[] = [];
  for (const paragraph of block.paragraphs) {
    const raw = paragraph.text.replace(/\s+/g, " ").trim();
    if (!raw) continue;
    const text = paragraph.uppercase ? raw.toUpperCase() : raw;
    const tracking = paragraph.tracking ?? 0;
    const maxWidth = Math.max(10, width - (paragraph.insetRight ?? 0));
    const baseLeading = paragraph.leading ?? paragraph.size * 1.25;

    if (paragraph.shrinkTo !== undefined) {
      let size = paragraph.size;
      while (size > paragraph.shrinkTo && measure(text, paragraph.font, size, tracking) > maxWidth) {
        size -= 1;
      }
      measured.push({
        paragraph,
        text,
        size,
        leading: baseLeading * (size / paragraph.size),
        lines: [text],
        maxWidth,
      });
      continue;
    }

    let lines = wrap(text, paragraph.font, paragraph.size, maxWidth, tracking);
    if (paragraph.maxLines !== undefined) {
      lines = fitLines(lines, paragraph.maxLines, paragraph.font, paragraph.size, maxWidth, tracking);
    }
    measured.push({ paragraph, text, size: paragraph.size, leading: baseLeading, lines, maxWidth });
  }

  // The one paragraph allowed to fill takes whatever height the rest leave.
  const filler = measured.find((entry) => entry.paragraph.fill);
  if (filler) {
    const others = measured
      .filter((entry) => entry !== filler)
      .reduce((sum, entry) => sum + (entry.paragraph.gap ?? 0) + entry.lines.length * entry.leading, 0);
    const room = Math.floor((height - others - (filler.paragraph.gap ?? 0) + 0.001) / filler.leading);
    filler.lines = fitLines(
      filler.lines,
      Math.max(0, room),
      filler.paragraph.font,
      filler.size,
      filler.maxWidth,
      filler.paragraph.tracking ?? 0,
    );
  }

  const used = measured.filter((entry) => entry.lines.length > 0);
  const total = used.reduce(
    (sum, entry, index) =>
      sum + (index === 0 ? 0 : (entry.paragraph.gap ?? 0)) + entry.lines.length * entry.leading,
    0,
  );
  let cursor =
    block.valign === "middle"
      ? (height - total) / 2
      : block.valign === "bottom"
        ? height - total
        : 0;

  const lines: LaidLine[] = [];
  const pills: LaidPill[] = [];
  for (const [index, entry] of used.entries()) {
    const { paragraph } = entry;
    if (index > 0) cursor += paragraph.gap ?? 0;
    const metrics = FACE_METRICS[paragraph.font];
    const content = (metrics.ascent + metrics.descent) * entry.size;
    const tracking = paragraph.tracking ?? 0;
    const align = paragraph.align ?? "left";
    for (const text of entry.lines) {
      const baseline = cursor + (entry.leading - content) / 2 + metrics.ascent * entry.size;
      const textWidth = measure(text, paragraph.font, entry.size, tracking);
      lines.push({
        text,
        font: paragraph.font,
        size: entry.size,
        color: paragraph.color,
        opacity: paragraph.opacity ?? 1,
        tracking,
        align,
        left: 0,
        width: entry.maxWidth,
        baseline,
        textWidth,
      });
      if (paragraph.pill) {
        const lineLeft =
          align === "center"
            ? (entry.maxWidth - textWidth) / 2
            : align === "right"
              ? entry.maxWidth - textWidth
              : 0;
        pills.push({
          cx: lineLeft + textWidth / 2,
          cy: baseline - entry.size * 0.35,
          w: textWidth + entry.size * 2.6,
          h: entry.size * 2,
          color: paragraph.pill.color,
          opacity: paragraph.pill.opacity,
        });
      }
      cursor += entry.leading;
    }
  }

  const rules: LaidRule[] = [];
  if (block.ruled && lines.length > 0) {
    const first = lines[0]!;
    const step = used[0]!.leading;
    const offset = first.size * 0.28;
    let y = first.baseline + offset;
    while (y - step > 0) y -= step;
    for (; y < height; y += step) {
      rules.push({ x1: 0, x2: width, y, color: block.ruled.color, opacity: block.ruled.opacity });
    }
  }

  return {
    left: block.x * PAGE_PT,
    top: block.y * PAGE_PT,
    width,
    height,
    rotation: block.rotation ?? 0,
    used: total,
    lines,
    pills,
    rules,
  };
}
