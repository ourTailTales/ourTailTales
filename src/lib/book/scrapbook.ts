import { FIXED_SLOTS, LAYOUTS } from "@/lib/book/layouts";
import type { BookPalette } from "@/lib/book/palette";
import type { BookPage, Slot } from "@/types/book";
import type { Orientation } from "@/types/photo";

/**
 * The book's page design: a clean scrapbook.
 *
 * Photos are prints, not rectangles: a white border (a polaroid's deep bottom
 * edge where there is room for a date), a slight tilt, a soft shadow, and a
 * strip or two of washi tape holding them to the page. Pastel paper scraps sit
 * behind some of them, and a hand-drawn doodle or two fills a spare corner.
 *
 * Everything here is pure data in normalized page space (0..1 of the full
 * bleed page, y running down, the page is square). The web viewer
 * (`PageCanvas`) and the print renderer (`interior-pdf`) both draw from the
 * same `PageDesign`, so a tilt on screen is the same tilt on paper. Every
 * "random" choice is seeded by the page and slot, so a page looks the same
 * every time it is drawn, on every device, and in the filmstrip thumbnail.
 *
 * The slot geometry in `layouts.ts` is untouched: prints sit inside their
 * slots, which is what keeps Video Memory placements and layout choice
 * meaningful.
 */

export type Box = {
  /** Centre, normalized. */
  cx: number;
  cy: number;
  /** Size, normalized. */
  w: number;
  h: number;
};

export type Tape = Box & {
  /** Degrees, clockwise as seen on the page. */
  rotation: number;
  color: string;
  opacity: number;
};

export type Print = Box & {
  rotation: number;
  /** Border on the top, left and right. */
  side: number;
  /** Border along the bottom — deep on a polaroid. */
  bottom: number;
  photoId: string | undefined;
  /** Handwritten on the polaroid's bottom edge, e.g. "June 2019". */
  caption: string | null;
  tapes: Tape[];
};

export type Scrap = Box & {
  rotation: number;
  color: string;
  opacity: number;
};

export type DoodleKind = "heart" | "star" | "sparkle" | "loop" | "paw" | "wave";

export type Doodle = {
  kind: DoodleKind;
  cx: number;
  cy: number;
  /** Width and height of the doodle's square box. */
  size: number;
  rotation: number;
  color: string;
};

export type PageDesign = {
  paper: string;
  scraps: Scrap[];
  prints: Print[];
  doodles: Doodle[];
};

export type DesignContext = {
  orientationOf: (photoId: string) => Orientation | undefined;
  captionOf: (photoId: string) => string | null;
  /** The book's colors — chosen for this pet (see `palette.ts`). */
  palette: BookPalette;
};

/* ------------------------------ palette ------------------------------ */

/** Cards are always white: they are the paper the words are written on. */
export const CARD = "#ffffff";

/** Nothing decorative gets closer to the page edge than this. */
export const DECOR_EDGE = 0.055;

/* ------------------------------ fixed text areas ------------------------------ */

/** Where each fixed page puts its words, shared by both renderers. */

/** Chapter opener type, in points on the 630pt page. */
export const OPENER_TYPE = {
  date: 20,
  title: 32,
  titleLeading: 35,
  blurb: 14,
  blurbLeading: 19.5,
} as const;

/** Dedication type, in points. */
export function dedicationType(text: string): { size: number; leading: number } {
  const size = text.length > 180 ? 17 : 21;
  return { size, leading: Math.round(size * 1.55) };
}
export const TITLE_TEXT = {
  /** Baseline of "For Biscuit", measured from the top. */
  headingBaseline: 0.225,
  headingSize: 64,
  /** Centre of the years stamp. */
  yearsCy: 0.285,
  brandBaseline: 0.93,
} as const;

export const DEDICATION_CARD: Box = { cx: 0.5, cy: 0.49, w: 0.64, h: 0.42 };

export const OPENER_CARD: Box = { cx: 0.5, cy: 0.255, w: 0.82, h: 0.35 };
/** Inside the card: where the date, title and blurb go. */
export const OPENER_TEXT: Box = { cx: 0.5, cy: 0.26, w: 0.7, h: 0.3 };
export const OPENER_STICKER = { cx: 0.87, cy: 0.1, r: 0.048 } as const;

export const CLOSING_TEXT = { baseline: 0.905, size: 30 } as const;

/* ------------------------------ randomness ------------------------------ */

function hashString(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/** mulberry32: small, fast, and identical in every JavaScript engine. */
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

function between(random: () => number, min: number, max: number): number {
  return min + random() * (max - min);
}

function pick<T>(random: () => number, items: readonly T[]): T {
  return items[Math.floor(random() * items.length) % items.length]!;
}

/* ------------------------------ geometry ------------------------------ */

/** Half-extents of a box's axis-aligned bounds once rotated. */
export function rotatedHalfExtents(box: Box & { rotation: number }): {
  hw: number;
  hh: number;
} {
  const radians = (box.rotation * Math.PI) / 180;
  const cos = Math.abs(Math.cos(radians));
  const sin = Math.abs(Math.sin(radians));
  return {
    hw: (box.w / 2) * cos + (box.h / 2) * sin,
    hh: (box.w / 2) * sin + (box.h / 2) * cos,
  };
}

/** Rotates a point given relative to a centre, clockwise on a y-down page. */
function rotateAround(
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

/** Pulls a rotated box back inside the decorative edge. */
function keepOnPage<T extends Box & { rotation: number }>(box: T, edge: number): T {
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

type TapeStyle = "top" | "corners" | "diagonal";

function tapesFor(
  print: Box & { rotation: number },
  random: () => number,
  palette: BookPalette,
  style: TapeStyle = pick(random, ["top", "top", "corners", "diagonal"] as const),
): Tape[] {
  const length = Math.min(Math.max(print.w * 0.3, 0.07), 0.14);
  const thickness = Math.max(length * 0.3, 0.024);
  const color = pick(random, palette.tape);

  const place = (dx: number, dy: number, turn: number): Tape => {
    const point = rotateAround(print.cx, print.cy, dx, dy, print.rotation);
    return {
      cx: point.x,
      cy: point.y,
      w: length,
      h: thickness,
      rotation: print.rotation + turn,
      color,
      opacity: 0.82,
    };
  };

  switch (style) {
    case "corners":
      return [
        place(-print.w / 2 + length * 0.18, -print.h / 2 + length * 0.18, -42 + between(random, -5, 5)),
        place(print.w / 2 - length * 0.18, -print.h / 2 + length * 0.18, 42 + between(random, -5, 5)),
      ];
    case "diagonal":
      return [
        place(-print.w / 2 + length * 0.18, -print.h / 2 + length * 0.18, -42 + between(random, -5, 5)),
        place(print.w / 2 - length * 0.18, print.h / 2 - length * 0.18, -42 + between(random, -5, 5)),
      ];
    case "top":
    default:
      return [place(between(random, -0.2, 0.2) * print.w * 0.3, -print.h / 2, between(random, -6, 6))];
  }
}

/* ------------------------------ prints ------------------------------ */

/** Photo-window size for a hero print of a given orientation. */
function heroWindow(
  orientation: Orientation | undefined,
  sizes: { landscape: [number, number]; portrait: [number, number]; square: [number, number] },
): [number, number] {
  if (orientation === "portrait") return sizes.portrait;
  if (orientation === "square") return sizes.square;
  return sizes.landscape;
}

function heroPrint(args: {
  photoId: string | undefined;
  context: DesignContext;
  random: () => number;
  cx: number;
  cy: number;
  window: [number, number];
  rotation: number;
  polaroid: boolean;
  tapeStyle?: TapeStyle;
}): Print {
  const [windowW, windowH] = args.window;
  const side = Math.min(Math.max(Math.min(windowW, windowH) * 0.045, 0.012), 0.022);
  const bottom = args.polaroid ? side * 3.4 : side;
  const base = keepOnPage(
    {
      cx: args.cx,
      cy: args.cy,
      w: windowW + side * 2,
      h: windowH + side + bottom,
      rotation: args.rotation,
    },
    DECOR_EDGE,
  );
  return {
    ...base,
    side,
    bottom,
    photoId: args.photoId,
    caption: args.polaroid && args.photoId ? args.context.captionOf(args.photoId) : null,
    tapes: tapesFor(base, args.random, args.context.palette, args.tapeStyle),
  };
}

function slotPrint(args: {
  slot: Slot;
  photoId: string | undefined;
  context: DesignContext;
  random: () => number;
  index: number;
  polaroid: boolean;
}): Print {
  const { slot, random } = args;
  const inset = Math.min(slot.w, slot.h) * 0.07;
  const w = slot.w - inset * 2;
  const h = slot.h - inset * 2;
  const side = Math.min(Math.max(Math.min(w, h) * 0.045, 0.011), 0.02);
  const bottom = args.polaroid ? side * 3.2 : side;
  // Neighbours lean opposite ways, which is what makes a page look placed by
  // hand rather than rotated by a program.
  const lean = (args.index % 2 === 0 ? 1 : -1) * (random() < 0.5 ? 1 : -1);
  const base = keepOnPage(
    {
      cx: slot.x + slot.w / 2 + between(random, -0.006, 0.006),
      cy: slot.y + slot.h / 2 + between(random, -0.006, 0.006),
      w,
      h,
      rotation: lean * between(random, 0.8, 2.6),
    },
    DECOR_EDGE,
  );
  return {
    ...base,
    side,
    bottom,
    photoId: args.photoId,
    caption: args.polaroid && args.photoId ? args.context.captionOf(args.photoId) : null,
    tapes: tapesFor(base, random, args.context.palette),
  };
}

/* ------------------------------ scraps & doodles ------------------------------ */

function paperScrap(random: () => number, palette: BookPalette): Scrap {
  // Anchored to a corner and running off the page, like a torn sheet tucked
  // under the prints.
  const corner = Math.floor(random() * 4);
  const w = between(random, 0.46, 0.62);
  const h = between(random, 0.34, 0.5);
  const cx = corner % 2 === 0 ? w / 2 - 0.02 : 1 - w / 2 + 0.02;
  const cy = corner < 2 ? h / 2 - 0.02 : 1 - h / 2 + 0.02;
  return {
    cx,
    cy,
    w,
    h,
    rotation: between(random, -5, 5),
    color: pick(random, palette.scraps),
    opacity: 0.55,
  };
}

const DOODLE_SPOTS: readonly [number, number][] = [
  [0.085, 0.075],
  [0.915, 0.075],
  [0.085, 0.925],
  [0.915, 0.925],
  [0.5, 0.06],
  [0.5, 0.94],
  [0.06, 0.5],
  [0.94, 0.5],
];

function overlaps(
  spot: { cx: number; cy: number; size: number },
  boxes: (Box & { rotation: number })[],
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

function doodlesFor(
  random: () => number,
  palette: BookPalette,
  occupied: (Box & { rotation: number })[],
  count: number,
  kinds: readonly DoodleKind[] = ["heart", "star", "sparkle", "sparkle", "loop", "wave", "paw"],
): Doodle[] {
  const doodles: Doodle[] = [];
  const spots = [...DOODLE_SPOTS].sort(() => random() - 0.5);
  for (const [cx, cy] of spots) {
    if (doodles.length >= count) break;
    const size = between(random, 0.042, 0.056);
    const candidate = { cx, cy, size };
    if (overlaps(candidate, occupied, 0.008)) continue;
    if (overlaps(candidate, doodles.map((doodle) => ({ ...doodle, w: doodle.size, h: doodle.size })), 0.02)) continue;
    doodles.push({
      kind: pick(random, kinds),
      cx,
      cy,
      size,
      rotation: between(random, -18, 18),
      color: pick(random, [palette.doodle, palette.doodle, palette.accent]),
    });
  }
  return doodles;
}

function occupiedBy(prints: Print[]): (Box & { rotation: number })[] {
  return prints.flatMap((print) => [print, ...print.tapes]);
}

function doodleCount(random: () => number): number {
  const roll = random();
  return roll < 0.3 ? 0 : roll < 0.8 ? 1 : 2;
}

/* ------------------------------ pages ------------------------------ */

export function designPage(page: BookPage, context: DesignContext): PageDesign {
  const random = seededRandom(page.id);
  const photoId = page.photoIds[0];
  const orientation = photoId ? context.orientationOf(photoId) : undefined;

  switch (page.kind) {
    case "title": {
      const slot = FIXED_SLOTS.titleHero;
      const print = heroPrint({
        photoId,
        context,
        random,
        cx: 0.5,
        cy: slot.y + slot.h / 2 + 0.01,
        window: heroWindow(orientation, {
          landscape: [0.5, 0.375],
          portrait: [0.32, 0.43],
          square: [0.4, 0.4],
        }),
        rotation: -2.2,
        polaroid: true,
        tapeStyle: "top",
      });
      return {
        paper: context.palette.paper,
        scraps: [],
        prints: [print],
        doodles: doodlesFor(random, context.palette, [...occupiedBy([print]), titleTextBox()], 2, [
          "sparkle",
          "heart",
          "star",
        ]),
      };
    }

    case "dedication": {
      return {
        paper: context.palette.paper,
        scraps: [
          {
            ...DEDICATION_CARD,
            w: DEDICATION_CARD.w + 0.05,
            h: DEDICATION_CARD.h + 0.04,
            rotation: -3,
            color: context.palette.scraps[1] ?? context.palette.scraps[0]!,
            opacity: 0.6,
          },
        ],
        prints: [],
        doodles: [
          {
            kind: "heart",
            cx: 0.5,
            cy: DEDICATION_CARD.cy + DEDICATION_CARD.h / 2 + 0.08,
            size: 0.045,
            rotation: -8,
            color: context.palette.doodle,
          },
        ],
      };
    }

    case "chapter-opener": {
      const print = heroPrint({
        photoId,
        context,
        random,
        cx: 0.5,
        cy: 0.705,
        window: heroWindow(orientation, {
          landscape: [0.72, 0.37],
          portrait: [0.72, 0.37],
          square: [0.72, 0.37],
        }),
        rotation: (random() < 0.5 ? -1 : 1) * between(random, 0.8, 1.6),
        polaroid: false,
        tapeStyle: "corners",
      });
      return {
        paper: context.palette.paper,
        scraps: [
          {
            ...OPENER_CARD,
            w: OPENER_CARD.w + 0.04,
            h: OPENER_CARD.h + 0.035,
            rotation: (random() < 0.5 ? -1 : 1) * between(random, 1.8, 3),
            color: pick(random, context.palette.scraps),
            opacity: 0.7,
          },
        ],
        prints: [print],
        doodles: doodlesFor(random, context.palette, [...occupiedBy([print]), { ...OPENER_CARD, w: OPENER_CARD.w + 0.06, h: OPENER_CARD.h + 0.06, rotation: 0 }], 1),
      };
    }

    case "closing": {
      const print = heroPrint({
        photoId,
        context,
        random,
        cx: 0.5,
        cy: 0.45,
        window: heroWindow(orientation, {
          landscape: [0.64, 0.48],
          portrait: [0.42, 0.56],
          square: [0.52, 0.52],
        }),
        rotation: 1.6,
        polaroid: true,
        tapeStyle: "top",
      });
      return {
        paper: context.palette.paper,
        scraps: [],
        prints: [print],
        doodles: doodlesFor(random, context.palette,
          [...occupiedBy([print]), { cx: 0.5, cy: CLOSING_TEXT.baseline - 0.02, w: 0.7, h: 0.08, rotation: 0 }],
          1,
          ["heart", "sparkle"],
        ),
      };
    }

    case "imprint":
      return { paper: context.palette.paper, scraps: [], prints: [], doodles: [] };

    default: {
      if (!page.layoutId) return { paper: context.palette.paper, scraps: [], prints: [], doodles: [] };
      const layout = LAYOUTS[page.layoutId];
      const polaroid = page.photoIds.length <= 2;

      const prints: Print[] =
        page.layoutId === "full-bleed"
          ? [
              heroPrint({
                photoId,
                context,
                random,
                cx: 0.5 + between(random, -0.015, 0.015),
                cy: 0.48,
                window: heroWindow(orientation, {
                  landscape: [0.74, 0.555],
                  portrait: [0.5, 0.667],
                  square: [0.62, 0.62],
                }),
                rotation: (random() < 0.5 ? -1 : 1) * between(random, 1, 2.4),
                polaroid: true,
              }),
            ]
          : page.photoIds.flatMap((id, index) => {
              const slot = layout.slots[index];
              return slot
                ? [slotPrint({ slot, photoId: id, context, random, index, polaroid })]
                : [];
            });

      const scraps = random() < 0.6 ? [paperScrap(random, context.palette)] : [];
      return {
        paper: context.palette.paper,
        scraps,
        prints,
        doodles: doodlesFor(random, context.palette, occupiedBy(prints), doodleCount(random)),
      };
    }
  }
}

/** The title page's words, kept clear of doodles. */
function titleTextBox(): Box & { rotation: number } {
  return { cx: 0.5, cy: 0.23, w: 0.72, h: 0.16, rotation: 0 };
}

/* ------------------------------ captions ------------------------------ */

/** "June 2019", from when the photo was taken. */
export function photoCaption(capturedAt: number | null | undefined): string | null {
  if (!capturedAt) return null;
  const date = new Date(capturedAt);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

/* ------------------------------ doodle drawings ------------------------------ */

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
};

/** Stroke width for outline doodles, in the 24-unit box. */
export const DOODLE_STROKE = 1.5;
