import {
  dedicationType,
  fromPt,
  heroOf,
  imprintTexts,
  lineAt,
  toPt,
  type BookDesign,
} from "@/lib/book/design/common";
import {
  CARD,
  between,
  emptyDesign,
  keepOnPage,
  lifespanText,
  overlaps,
  pick,
  rotateAround,
  seededRandom,
  type Box,
  type DesignContext,
  type Doodle,
  type DoodleKind,
  type PageDesign,
  type Print,
  type RectShape,
  type Rotated,
  type Tape,
  type TextBlock,
} from "@/lib/book/design/primitives";
import { SAFE, STANDARD_GUTTER, gridSlots, isPhotoLayout } from "@/lib/book/layouts";
import { CLOSING_LINE, titlePageHeading } from "@/lib/book/pagination";
import type { BookPalette } from "@/lib/book/palette";
import type { BookPage, Slot } from "@/types/book";
import type { Orientation } from "@/types/photo";

/**
 * Scrapbook: the book's original design, and the one every free preview is
 * printed in.
 *
 * Photos are prints, not rectangles: a white border (a polaroid's deep bottom
 * edge where there is room for a date), a slight tilt, a soft shadow, and a
 * strip or two of washi tape holding them to the page. Pastel paper scraps sit
 * behind some of them, and a hand-drawn doodle or two fills a spare corner.
 */

/** Nothing decorative gets closer to the page edge than this. */
export const DECOR_EDGE = 0.055;

const CONTENT: Slot = { x: SAFE, y: SAFE, w: 1 - SAFE * 2, h: 1 - SAFE * 2 };
const GRID = { gutter: STANDARD_GUTTER, feature: 0.6505, lead: 0.563 };

const DEDICATION_CARD: Box = { cx: 0.5, cy: 0.49, w: 0.64, h: 0.42 };
const OPENER_CARD: Box = { cx: 0.5, cy: 0.255, w: 0.82, h: 0.35 };
/** Inside the card: where the date, title and blurb go. */
const OPENER_TEXT: Box = { cx: 0.5, cy: 0.26, w: 0.7, h: 0.3 };
const OPENER_STICKER = { cx: 0.87, cy: 0.1, r: 0.048 } as const;
const TITLE_HERO: Slot = { x: 0.24, y: 0.5, w: 0.52, h: 0.3 };

/* ------------------------------ tape ------------------------------ */

type TapeStyle = "top" | "corners" | "diagonal";

function tapesFor(
  print: Rotated,
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

type HeroSizes = { landscape: [number, number]; portrait: [number, number]; square: [number, number] };

/** Photo-window size for a hero print of a given orientation. */
function heroWindow(orientation: Orientation | undefined, sizes: HeroSizes): [number, number] {
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
    border: CARD,
    shadow: true,
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
    border: CARD,
    shadow: true,
    photoId: args.photoId,
    caption: args.polaroid && args.photoId ? args.context.captionOf(args.photoId) : null,
    tapes: tapesFor(base, random, args.context.palette),
  };
}

/* ------------------------------ scraps & doodles ------------------------------ */

function paperScrap(random: () => number, palette: BookPalette): RectShape {
  // Anchored to a corner and running off the page, like a torn sheet tucked
  // under the prints.
  const corner = Math.floor(random() * 4);
  const w = between(random, 0.46, 0.62);
  const h = between(random, 0.34, 0.5);
  const cx = corner % 2 === 0 ? w / 2 - 0.02 : 1 - w / 2 + 0.02;
  const cy = corner < 2 ? h / 2 - 0.02 : 1 - h / 2 + 0.02;
  return {
    kind: "rect",
    cx,
    cy,
    w,
    h,
    rotation: between(random, -5, 5),
    fill: pick(random, palette.scraps),
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

function doodlesFor(
  random: () => number,
  palette: BookPalette,
  occupied: Rotated[],
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

function occupiedBy(prints: Print[]): Rotated[] {
  return prints.flatMap((print) => [print, ...print.tapes]);
}

function doodleCount(random: () => number): number {
  const roll = random();
  return roll < 0.3 ? 0 : roll < 0.8 ? 1 : 2;
}

/* ------------------------------ words ------------------------------ */

function titleTexts(context: DesignContext): TextBlock[] {
  const { palette, meta } = context;
  const years = lifespanText(meta);
  const texts: TextBlock[] = [
    lineAt({
      baseline: 0.225,
      x: 0.11,
      paragraph: {
        text: titlePageHeading(meta.petName),
        font: "hand",
        size: 64,
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
    texts.push(
      lineAt({
        baseline: 0.285 + fromPt(3.5),
        x: 0.2,
        paragraph: {
          text: years,
          font: "sans",
          size: 10,
          tracking: 2.4,
          uppercase: true,
          color: palette.accent,
          align: "center",
          pill: { color: palette.accent, opacity: 0.8 },
        },
      }),
    );
  }
  return texts;
}

function dedicationTexts(context: DesignContext): TextBlock[] {
  const text = context.meta.dedication.trim();
  if (!text) return [];
  const { size, leading } = dedicationType(text);
  const card = DEDICATION_CARD;
  return [
    {
      x: card.cx - card.w / 2 + fromPt(26),
      y: card.cy - card.h / 2 + fromPt(30),
      w: card.w - fromPt(52),
      h: card.h - fromPt(50),
      valign: "middle",
      ruled: { color: context.palette.accent, opacity: 0.2 },
      paragraphs: [
        { text, font: "serifItalic", size, leading, color: context.palette.ink, align: "center" },
      ],
    },
  ];
}

function openerTexts(context: DesignContext): TextBlock[] {
  const { chapter, palette } = context;
  if (!chapter) return [];
  const box = OPENER_TEXT;
  const r = OPENER_STICKER.r;
  const numberSize = toPt(r) * 1.05;
  return [
    {
      x: box.cx - box.w / 2,
      y: box.cy - box.h / 2,
      w: box.w,
      h: box.h,
      valign: "top",
      paragraphs: [
        { text: chapter.dateLabel, font: "hand", size: 20, leading: 22, color: palette.accent },
        {
          text: chapter.title,
          font: "serifBold",
          size: 32,
          leading: 35,
          color: palette.ink,
          gap: 8,
          // Clear of the chapter sticker.
          insetRight: 48,
        },
        { text: chapter.blurb, font: "serif", size: 14, leading: 19.5, color: palette.inkSoft, gap: 6, fill: true },
      ],
    },
    {
      ...lineAt({
        baseline: OPENER_STICKER.cy + fromPt(numberSize * 0.34),
        x: OPENER_STICKER.cx - r,
        w: r * 2,
        rotation: -6,
        paragraph: { text: String(chapter.index + 1), font: "handBold", size: numberSize, color: CARD, align: "center" },
      }),
    },
  ];
}

/* ------------------------------ pages ------------------------------ */

function designPage(page: BookPage, context: DesignContext): PageDesign {
  const random = seededRandom(page.id);
  const photoId = heroOf(page);
  const orientation = photoId ? context.orientationOf(photoId) : undefined;
  const { palette } = context;
  const design = emptyDesign(palette.paper);

  switch (page.kind) {
    case "title": {
      const print = heroPrint({
        photoId,
        context,
        random,
        cx: 0.5,
        cy: TITLE_HERO.y + TITLE_HERO.h / 2 + 0.01,
        window: heroWindow(orientation, { landscape: [0.5, 0.375], portrait: [0.32, 0.43], square: [0.4, 0.4] }),
        rotation: -2.2,
        polaroid: true,
        tapeStyle: "top",
      });
      design.prints = [print];
      design.doodles = doodlesFor(
        random,
        palette,
        [...occupiedBy([print]), { cx: 0.5, cy: 0.23, w: 0.72, h: 0.16, rotation: 0 }],
        2,
        ["sparkle", "heart", "star"],
      );
      design.texts = titleTexts(context);
      return design;
    }

    case "dedication": {
      const card = DEDICATION_CARD;
      design.under = [
        {
          kind: "rect",
          ...card,
          w: card.w + 0.05,
          h: card.h + 0.04,
          rotation: -3,
          fill: palette.scraps[1] ?? palette.scraps[0]!,
          opacity: 0.6,
        },
        { kind: "rect", ...card, rotation: 0, fill: CARD, shadow: true },
      ];
      design.over = [
        {
          kind: "tape",
          cx: card.cx,
          cy: card.cy - card.h / 2,
          w: 0.13,
          h: 0.036,
          rotation: -3,
          color: palette.tape[1] ?? palette.tape[0]!,
          opacity: 0.82,
        },
      ];
      design.doodles = [
        {
          kind: "heart",
          cx: 0.5,
          cy: card.cy + card.h / 2 + 0.08,
          size: 0.045,
          rotation: -8,
          color: palette.doodle,
        },
      ];
      design.texts = dedicationTexts(context);
      return design;
    }

    case "chapter-opener": {
      const print = heroPrint({
        photoId,
        context,
        random,
        cx: 0.5,
        cy: 0.705,
        window: [0.72, 0.37],
        rotation: (random() < 0.5 ? -1 : 1) * between(random, 0.8, 1.6),
        polaroid: false,
        tapeStyle: "corners",
      });
      design.under = [
        {
          kind: "rect",
          ...OPENER_CARD,
          w: OPENER_CARD.w + 0.04,
          h: OPENER_CARD.h + 0.035,
          rotation: (random() < 0.5 ? -1 : 1) * between(random, 1.8, 3),
          fill: pick(random, palette.scraps),
          opacity: 0.7,
        },
        { kind: "rect", ...OPENER_CARD, rotation: 0, fill: CARD, shadow: true },
      ];
      design.prints = [print];
      design.doodles = doodlesFor(
        random,
        palette,
        [...occupiedBy([print]), { ...OPENER_CARD, w: OPENER_CARD.w + 0.06, h: OPENER_CARD.h + 0.06, rotation: 0 }],
        1,
      );
      if (context.chapter) {
        const { cx, cy, r } = OPENER_STICKER;
        design.over = [
          { kind: "circle", cx, cy, r, fill: palette.accent, shadow: true },
          { kind: "circle", cx, cy, r: r * 0.86, stroke: { color: CARD, width: 0.8, opacity: 0.7, dash: 2 } },
        ];
      }
      design.texts = openerTexts(context);
      return design;
    }

    case "closing": {
      const print = heroPrint({
        photoId,
        context,
        random,
        cx: 0.5,
        cy: 0.45,
        window: heroWindow(orientation, { landscape: [0.64, 0.48], portrait: [0.42, 0.56], square: [0.52, 0.52] }),
        rotation: 1.6,
        polaroid: true,
        tapeStyle: "top",
      });
      design.prints = [print];
      design.doodles = doodlesFor(
        random,
        palette,
        [...occupiedBy([print]), { cx: 0.5, cy: 0.885, w: 0.7, h: 0.08, rotation: 0 }],
        1,
        ["heart", "sparkle"],
      );
      design.texts = [
        lineAt({
          baseline: 0.905,
          paragraph: { text: CLOSING_LINE, font: "hand", size: 30, color: palette.ink, align: "center" },
        }),
      ];
      return design;
    }

    case "imprint":
      design.texts = imprintTexts(context);
      return design;

    default:
      return photoPage(page, context, random, design);
  }
}

function photoPage(
  page: BookPage,
  context: DesignContext,
  random: () => number,
  design: PageDesign,
): PageDesign {
  if (!isPhotoLayout(page.layoutId) || page.photoIds.length === 0) return design;
  const polaroid = page.photoIds.length <= 2;
  const photoId = page.photoIds[0];
  const orientation = photoId ? context.orientationOf(photoId) : undefined;
  const { palette } = context;

  let prints: Print[];
  let scrapChance = 0.6;
  let doodles = doodleCount(random);

  if (page.layoutId === "full-bleed") {
    prints = [
      heroPrint({
        photoId,
        context,
        random,
        cx: 0.5 + between(random, -0.015, 0.015),
        cy: 0.48,
        window: heroWindow(orientation, { landscape: [0.74, 0.555], portrait: [0.5, 0.667], square: [0.62, 0.62] }),
        rotation: (random() < 0.5 ? -1 : 1) * between(random, 1, 2.4),
        polaroid: true,
      }),
    ];
  } else if (page.layoutId === "single-framed") {
    // A smaller print set off-centre, with room around it for the page
    // itself: always a scrap behind, and a doodle or two more.
    const left = random() < 0.5;
    prints = [
      heroPrint({
        photoId,
        context,
        random,
        cx: left ? 0.44 : 0.56,
        cy: 0.47,
        window: heroWindow(orientation, { landscape: [0.56, 0.42], portrait: [0.4, 0.53], square: [0.48, 0.48] }),
        rotation: (left ? -1 : 1) * between(random, 2, 3.2),
        polaroid: true,
        tapeStyle: "corners",
      }),
    ];
    scrapChance = 1;
    doodles = 2;
  } else {
    const slots = gridSlots(page.layoutId, CONTENT, GRID);
    prints = page.photoIds.flatMap((id, index) => {
      const slot = slots[index];
      return slot ? [slotPrint({ slot, photoId: id, context, random, index, polaroid })] : [];
    });
  }

  design.under = random() < scrapChance ? [paperScrap(random, palette)] : [];
  design.prints = prints;
  design.doodles = doodlesFor(random, palette, occupiedBy(prints), doodles);
  return design;
}

export const scrapbook: BookDesign = {
  id: "scrapbook",
  name: "Scrapbook",
  tagline: "Polaroids, washi tape and doodles.",
  designPage,
};
