import type { BookPalette } from "@/lib/book/palette";
import type { BookMeta, Chapter } from "@/types/book";
import type { Orientation } from "@/types/photo";

/**
 * What a page is made of, in any design.
 *
 * A design (`designs/*.ts`) turns a `BookPage` into a `PageDesign`: plain data
 * in normalized page space (0..1 of the full bleed page, y running down, the
 * page is square). The web viewer (`PageCanvas`) and the print renderer
 * (`interior-pdf`) know nothing about scrapbooks or magazines — they draw these
 * primitives, in this order, and nothing else:
 *
 *   paper → under → prints → print tape & corners → over → doodles → texts
 *
 * That split is what lets a new design be added without touching either
 * renderer, and what keeps the page on screen and the page on paper the same
 * page.
 */

export type Box = {
  /** Centre, normalized. */
  cx: number;
  cy: number;
  /** Size, normalized. */
  w: number;
  h: number;
};

export type Rotated = Box & {
  /** Degrees, clockwise as seen on the page. */
  rotation: number;
};

export type Tape = Rotated & {
  color: string;
  opacity: number;
};

/** A photo mount: a small triangle folded over each corner of a print. */
export type PhotoCorners = {
  color: string;
  opacity: number;
  /** Length of each leg, normalized. */
  size: number;
};

export type FontRole =
  | "hand"
  | "handBold"
  | "serif"
  | "serifItalic"
  | "serifBold"
  | "display"
  | "displayBold"
  | "sans"
  | "sansBold";

/**
 * A photograph as placed on the page: its paper border (none, for a photo
 * printed straight onto the page), a shadow, a caption inside the border, and
 * whatever holds it down.
 */
export type Print = Rotated & {
  /** Border on the top, left and right. */
  side: number;
  /** Border along the bottom — deep on a polaroid. */
  bottom: number;
  /** The border's color. */
  border: string;
  /** Lifted off the page with a soft shadow. */
  shadow: boolean;
  /** A hairline around the photo itself, in points. */
  keyline?: { color: string; width: number; opacity: number };
  photoId: string | undefined;
  /** Written on the border's deep bottom edge, e.g. "June 2019". */
  caption: string | null;
  captionFont?: FontRole;
  captionColor?: string;
  tapes: Tape[];
  corners?: PhotoCorners;
};

export type RectShape = Rotated & {
  kind: "rect";
  fill?: string;
  opacity?: number;
  /** Outline, width in points. */
  stroke?: { color: string; width: number; opacity?: number };
  shadow?: boolean;
};

export type CircleShape = {
  kind: "circle";
  cx: number;
  cy: number;
  /** Radius, normalized. */
  r: number;
  fill?: string;
  opacity?: number;
  stroke?: { color: string; width: number; opacity?: number; dash?: number };
  shadow?: boolean;
};

export type LineShape = {
  kind: "line";
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color: string;
  /** Points. */
  width: number;
  opacity?: number;
};

export type TapeShape = Tape & { kind: "tape" };

export type Shape = RectShape | CircleShape | LineShape | TapeShape;

export type DoodleKind =
  | "heart"
  | "star"
  | "sparkle"
  | "loop"
  | "paw"
  | "wave"
  | "bone"
  | "bowl"
  | "rosette"
  | "pup"
  | "arrow";

export type Doodle = {
  kind: DoodleKind;
  cx: number;
  cy: number;
  /** Width and height of the doodle's square box. */
  size: number;
  rotation: number;
  color: string;
  /**
   * Filled rather than drawn, whatever the shape's own default is — a heart
   * drawn in pen becomes a heart cut out of vinyl.
   */
  fill?: boolean;
  /**
   * A contrasting edge around a filled doodle: the white border of a die-cut
   * sticker, which is what makes one read as stuck on rather than printed.
   */
  outline?: string;
};

/**
 * One run of words inside a text block. Sizes are in points on the 630pt
 * bleed page, the same unit the PDF draws in.
 */
export type Paragraph = {
  text: string;
  font: FontRole;
  size: number;
  /** Baseline to baseline, points. Defaults to 1.25× the size. */
  leading?: number;
  color: string;
  opacity?: number;
  align?: "left" | "center" | "right";
  /** Extra space between letters, points. */
  tracking?: number;
  uppercase?: boolean;
  /** Space above this paragraph, points. Ignored on a block's first paragraph. */
  gap?: number;
  /** Set on one line, shrinking toward this size until it fits. */
  shrinkTo?: number;
  /** The most lines this may take; cut with an ellipsis. */
  maxLines?: number;
  /** Take whatever height is left in the block; cut with an ellipsis. */
  fill?: boolean;
  /** Kept clear on the right, points — e.g. under a sticker. */
  insetRight?: number;
  /** A rounded outline around the line, like a date stamp. */
  pill?: { color: string; opacity: number };
};

export type TextBlock = {
  /** Top-left and size, normalized. */
  x: number;
  y: number;
  w: number;
  h: number;
  valign?: "top" | "middle" | "bottom";
  /** Degrees around the block's centre. */
  rotation?: number;
  paragraphs: Paragraph[];
  /** Ruled like a note card: a rule under every line, carried to the block's edges. */
  ruled?: { color: string; opacity: number };
};

export type PageDesign = {
  paper: string;
  /** Beneath the photos: paper scraps, cards, color fields, frames. */
  under: Shape[];
  prints: Print[];
  /** Above the photos: stickers, bands, loose tape. */
  over: Shape[];
  doodles: Doodle[];
  texts: TextBlock[];
};

/** Everything a design may know about the book while drawing one page. */
export type DesignContext = {
  meta: BookMeta;
  chapter: Chapter | undefined;
  orientationOf: (photoId: string) => Orientation | undefined;
  captionOf: (photoId: string) => string | null;
  /** The book's colors — chosen for this pet (see `palette.ts`). */
  palette: BookPalette;
};

/** Page size in points: 8.75in bleed page at 72pt/in. */
export const PAGE_PT = 630;

/** Cards are always white: they are the paper the words are written on. */
export const CARD = "#ffffff";

export function emptyDesign(paper: string): PageDesign {
  return { paper, under: [], prints: [], over: [], doodles: [], texts: [] };
}

/* ------------------------------ randomness ------------------------------ */

function hashString(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/**
 * mulberry32: small, fast, and identical in every JavaScript engine. Every
 * "random" choice a design makes is seeded by the page, so a page looks the
 * same every time it is drawn, on every device, and in the filmstrip.
 */
export function seededRandom(seed: string): () => number {
  let state = hashString(seed) || 1;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function between(random: () => number, min: number, max: number): number {
  return min + random() * (max - min);
}

export function pick<T>(random: () => number, items: readonly T[]): T {
  return items[Math.floor(random() * items.length) % items.length]!;
}

/* ------------------------------ geometry ------------------------------ */

/** Half-extents of a box's axis-aligned bounds once rotated. */
export function rotatedHalfExtents(box: Rotated): { hw: number; hh: number } {
  const radians = (box.rotation * Math.PI) / 180;
  const cos = Math.abs(Math.cos(radians));
  const sin = Math.abs(Math.sin(radians));
  return {
    hw: (box.w / 2) * cos + (box.h / 2) * sin,
    hh: (box.w / 2) * sin + (box.h / 2) * cos,
  };
}

/** Rotates a point given relative to a centre, clockwise on a y-down page. */
export function rotateAround(
  cx: number,
  cy: number,
  dx: number,
  dy: number,
  degrees: number,
): { x: number; y: number } {
  const radians = (degrees * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  return { x: cx + dx * cos - dy * sin, y: cy + dx * sin + dy * cos };
}

/** Pulls a rotated box back inside an edge margin, straightening it first if it must. */
export function keepOnPage<T extends Rotated>(box: T, edge: number): T {
  let rotation = box.rotation;
  let extents = rotatedHalfExtents({ ...box, rotation });
  // Straighten first: a big print near the edge reads better level than cut.
  while (
    Math.abs(rotation) > 0.2 &&
    (box.cx - extents.hw < edge ||
      box.cx + extents.hw > 1 - edge ||
      box.cy - extents.hh < edge ||
      box.cy + extents.hh > 1 - edge)
  ) {
    rotation *= 0.7;
    extents = rotatedHalfExtents({ ...box, rotation });
  }
  const cx = Math.min(Math.max(box.cx, edge + extents.hw), 1 - edge - extents.hw);
  const cy = Math.min(Math.max(box.cy, edge + extents.hh), 1 - edge - extents.hh);
  return { ...box, cx, cy, rotation };
}

/** The photo's rectangle inside its print, in the print's own unrotated frame. */
export function photoWindow(print: Print): { x: number; y: number; w: number; h: number } {
  return {
    x: print.side,
    y: print.side,
    w: Math.max(0, print.w - print.side * 2),
    h: Math.max(0, print.h - print.side - print.bottom),
  };
}

/** Whether a square spot overlaps any of the boxes, with padding. */
export function overlaps(
  spot: { cx: number; cy: number; size: number },
  boxes: Rotated[],
  pad: number,
): boolean {
  return boxes.some((box) => {
    const { hw, hh } = rotatedHalfExtents(box);
    return (
      Math.abs(spot.cx - box.cx) < hw + spot.size / 2 + pad &&
      Math.abs(spot.cy - box.cy) < hh + spot.size / 2 + pad
    );
  });
}

/** A top-left rectangle as a centred box. */
export function boxOf(rect: { x: number; y: number; w: number; h: number }): Box {
  return { cx: rect.x + rect.w / 2, cy: rect.y + rect.h / 2, w: rect.w, h: rect.h };
}

/* ------------------------------ prints ------------------------------ */

/** A photo printed straight onto the page, filling a rectangle: no border, no tilt. */
export function flatPrint(
  rect: { x: number; y: number; w: number; h: number },
  photoId: string | undefined,
  extra: Partial<Print> = {},
): Print {
  return {
    ...boxOf(rect),
    rotation: 0,
    side: 0,
    bottom: 0,
    border: CARD,
    shadow: false,
    photoId,
    caption: null,
    tapes: [],
    ...extra,
  };
}

/* ------------------------------ tape ------------------------------ */

/**
 * The outline of a strip of tape in unit space (0..1 both ways): a rectangle
 * whose two short ends are torn into small zig-zags.
 */
export const TAPE_OUTLINE: readonly [number, number][] = (() => {
  const teeth = 5;
  const depth = 0.045;
  const points: [number, number][] = [];
  for (let index = 0; index <= teeth; index += 1) {
    points.push([index % 2 === 0 ? 0 : depth, index / teeth]);
  }
  for (let index = teeth; index >= 0; index -= 1) {
    points.push([index % 2 === 0 ? 1 : 1 - depth, index / teeth]);
  }
  // Left end top to bottom, then the right end bottom to top; closing the
  // path runs along the top edge.
  return points;
})();

/* ------------------------------ doodles ------------------------------ */

function ellipse(cx: number, cy: number, rx: number, ry: number): string {
  const k = 0.5523;
  return [
    `M${cx - rx} ${cy}`,
    `C${cx - rx} ${cy - ry * k} ${cx - rx * k} ${cy - ry} ${cx} ${cy - ry}`,
    `C${cx + rx * k} ${cy - ry} ${cx + rx} ${cy - ry * k} ${cx + rx} ${cy}`,
    `C${cx + rx} ${cy + ry * k} ${cx + rx * k} ${cy + ry} ${cx} ${cy + ry}`,
    `C${cx - rx * k} ${cy + ry} ${cx - rx} ${cy + ry * k} ${cx - rx} ${cy}`,
    "Z",
  ].join(" ");
}

/**
 * Each doodle as an SVG path in a 24×24 box, drawn with a pen-width stroke or
 * filled. One set of paths for the inline SVG on screen and `drawSvgPath` in
 * the PDF.
 */
export const DOODLE_PATHS: Record<DoodleKind, { d: string; fill: boolean }> = {
  heart: {
    d: "M12 20.2C11.6 19.9 3.6 15 3.7 9.1C3.8 6.4 5.8 4.4 8.3 4.5C10 4.5 11.3 5.5 12 6.9C12.8 5.4 14.2 4.4 15.9 4.4C18.5 4.5 20.4 6.5 20.3 9.3C20.1 15.1 12.4 19.9 12 20.2Z",
    fill: false,
  },
  star: {
    d: "M12 3.3L14.5 9.1L20.7 9.5L16 13.5L17.5 19.6L12 16.3L6.5 19.7L8.1 13.4L3.3 9.4L9.5 9Z",
    fill: false,
  },
  sparkle: {
    d: "M12 2.5C12.7 8.1 15.9 11.3 21.5 12C15.9 12.7 12.7 15.9 12 21.5C11.3 15.9 8.1 12.7 2.5 12C8.1 11.3 11.3 8.1 12 2.5Z",
    fill: true,
  },
  loop: {
    d: "M2.8 17.5C6.2 17.8 8.6 14.6 7.6 11.4C6.8 8.8 3.4 9.4 4.1 12.2C5 15.7 10.9 16.2 14.2 12.6C16.4 10.2 17.8 8.2 21 7M21 7L17.6 5.8M21 7L19.8 10.4",
    fill: false,
  },
  wave: {
    d: "M2.5 13C4.5 9.5 6.5 9.5 8.3 13C10.1 16.5 12.1 16.5 14 13C15.9 9.5 17.9 9.5 19.8 13C20.4 14 21 14.6 21.5 14.8",
    fill: false,
  },
  paw: {
    d: [
      ellipse(12, 15.6, 4.6, 3.9),
      ellipse(6.2, 10.4, 1.7, 2.2),
      ellipse(9.8, 6.8, 1.7, 2.3),
      ellipse(14.2, 6.8, 1.7, 2.3),
      ellipse(17.8, 10.4, 1.7, 2.2),
    ].join(" "),
    fill: true,
  },
  /** A biscuit-shaped bone: a shaft with a knob at each of its four ends. */
  bone: {
    d: [
      "M6.8 9.7 L17.2 9.7 L17.2 14.3 L6.8 14.3 Z",
      ellipse(6.8, 10.1, 2.7, 2.6),
      ellipse(6.8, 13.9, 2.7, 2.6),
      ellipse(17.2, 10.1, 2.7, 2.6),
      ellipse(17.2, 13.9, 2.7, 2.6),
    ].join(" "),
    fill: true,
  },
  /** A supper bowl, drawn in pen: the rim, then the sides. */
  bowl: {
    d: "M4.3 10.5C4.3 8.6 19.7 8.6 19.7 10.5C19.7 12.1 4.3 12.1 4.3 10.5M4.8 11.6L6.7 18.1C7 19.1 17 19.1 17.3 18.1L19.2 11.6",
    fill: false,
  },
  /** A first-place rosette, ribbons and all. */
  rosette: {
    d: [
      ellipse(12, 9.2, 4.9, 4.9),
      ellipse(12, 9.2, 2.6, 2.6),
      "M9 13.1 L7.5 21.2 L12 18.5 L16.5 21.2 L15 13.1",
    ].join(" "),
    fill: false,
  },
  /** A dog looking back at the reader: ears, eyes, nose, and a small smile. */
  pup: {
    d: [
      ellipse(12, 13.6, 5.2, 4.5),
      "M7.9 9.9C6.3 7.5 6.9 4.9 8.7 5.5C10.1 6 10.9 7.5 11.1 8.9",
      "M16.1 9.9C17.7 7.5 17.1 4.9 15.3 5.5C13.9 6 13.1 7.5 12.9 8.9",
      ellipse(10.1, 12.7, 0.55, 0.72),
      ellipse(13.9, 12.7, 0.55, 0.72),
      ellipse(12, 14.9, 1.15, 0.88),
      "M12 15.8 L12 16.7 M12 16.7C11.2 17.6 10.2 17.2 10 16.5 M12 16.7C12.8 17.6 13.8 17.2 14 16.5",
    ].join(" "),
    fill: false,
  },
  /** The curved arrow an owner draws to point at the one they mean. */
  arrow: {
    d: "M3.5 6.5C7.5 5.5 14.5 6.5 17.5 13.5M17.5 13.5L13.6 12.3M17.5 13.5L18.8 9.6",
    fill: false,
  },
};

/** Stroke width for outline doodles, in the 24-unit box. */
export const DOODLE_STROKE = 1.5;

/* ------------------------------ words ------------------------------ */

/** "June 2019", from when the photo was taken. */
export function photoCaption(capturedAt: number | null | undefined): string | null {
  if (!capturedAt) return null;
  const date = new Date(capturedAt);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

/** "2011–2024", "2011", or nothing. */
export function lifespanText(meta: Pick<BookMeta, "birthYear" | "deathYear">): string {
  const birth = meta.birthYear.trim();
  const death = meta.deathYear.trim();
  if (birth && death) return `${birth}–${death}`;
  return birth || death;
}

const ONES = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine"];
const TEENS = [
  "Ten",
  "Eleven",
  "Twelve",
  "Thirteen",
  "Fourteen",
  "Fifteen",
  "Sixteen",
  "Seventeen",
  "Eighteen",
  "Nineteen",
];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty"];

/** 1 → "One", 23 → "Twenty-Three". Books stop at fifty chapters. */
export function numberWord(value: number): string {
  if (value <= 0 || value > 59) return String(value);
  if (value < 10) return ONES[value]!;
  if (value < 20) return TEENS[value - 10]!;
  const tens = TENS[Math.floor(value / 10)]!;
  const ones = ONES[value % 10]!;
  return ones ? `${tens}-${ones}` : tens;
}

/** 1 → "I", 14 → "XIV". */
export function romanNumeral(value: number): string {
  const table: [number, string][] = [
    [50, "L"],
    [40, "XL"],
    [10, "X"],
    [9, "IX"],
    [5, "V"],
    [4, "IV"],
    [1, "I"],
  ];
  let rest = Math.max(1, Math.floor(value));
  let out = "";
  for (const [amount, glyph] of table) {
    while (rest >= amount) {
      out += glyph;
      rest -= amount;
    }
  }
  return out;
}

/**
 * A print's photo corners as triangles, in the print's own unrotated frame
 * (origin top-left, y down, normalized). Each sits over one corner of the
 * print, its right angle just outside it.
 */
export function cornerTriangles(print: Print): [number, number][][] {
  if (!print.corners) return [];
  const s = print.corners.size;
  const o = s * 0.14;
  const { w, h } = print;
  return [
    [
      [-o, -o],
      [s - o, -o],
      [-o, s - o],
    ],
    [
      [w + o, -o],
      [w + o - s, -o],
      [w + o, s - o],
    ],
    [
      [-o, h + o],
      [s - o, h + o],
      [-o, h + o - s],
    ],
    [
      [w + o, h + o],
      [w + o - s, h + o],
      [w + o, h + o - s],
    ],
  ];
}

/** Caption ink when a design does not name one. */
export const DEFAULT_CAPTION_COLOR = "#252a3a";
