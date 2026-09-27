import {
  fromPt,
  heroOf,
  imprintTexts,
  isEmptyNote,
  lineAt,
  noteParagraphs,
  pageNotes,
  textHeight,
  toPt,
  type BookDesign,
  type PageNote,
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
  rotatedHalfExtents,
  seededRandom,
  type Box,
  type DesignContext,
  type Doodle,
  type DoodleKind,
  type PageDesign,
  type Print,
  type RectShape,
  type Rotated,
  type Shape,
  type Tape,
  type TextBlock,
} from "@/lib/book/design/primitives";
import {
  SAFE,
  STANDARD_GUTTER,
  gridSlots,
  isCaptionLayout,
  isPhotoLayout,
  layoutRegions,
} from "@/lib/book/layouts";
import { CLOSING_LINE, titlePageHeading } from "@/lib/book/pagination";
import type { BookPalette } from "@/lib/book/palette";
import type { BookPage, PhotoLayoutId, Slot } from "@/types/book";
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
const GRID = {
  gutter: STANDARD_GUTTER,
  feature: 0.6505,
  lead: 0.563,
  noteShare: 0.35,
  noteGap: STANDARD_GUTTER * 1.5,
};

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
  // Not every print fills its slot to the same edge: a hand laying photos on
  // a page leaves uneven white between them, and that unevenness is most of
  // what separates a scrapbook page from a contact sheet.
  const inset = Math.min(slot.w, slot.h) * between(random, 0.05, 0.095);
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

function paperScrap(
  random: () => number,
  palette: BookPalette,
  corner = Math.floor(random() * 4),
): RectShape {
  // Anchored to a corner and running off the page, like a torn sheet tucked
  // under the prints.
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

/**
 * A strip of patterned paper laid along one edge, running off both ends.
 *
 * A page whose photographs sit in the middle leaves two bands of bare paper
 * down its sides, and a corner scrap only ever answers one of them. This is
 * what an album actually has there: a length of backing paper, slightly out
 * of true, the photographs overlapping it.
 */
function paperStrip(random: () => number, palette: BookPalette): RectShape {
  const upright = random() < 0.5;
  const thickness = between(random, 0.08, 0.13);
  const near = random() < 0.5;
  const along = near ? thickness / 2 - 0.015 : 1 - thickness / 2 + 0.015;
  return {
    kind: "rect",
    cx: upright ? along : 0.5,
    cy: upright ? 0.5 : along,
    w: upright ? thickness : 1.12,
    h: upright ? 1.12 : thickness,
    rotation: (random() < 0.5 ? -1 : 1) * between(random, 0.4, 1.4),
    fill: pick(random, palette.scraps),
    opacity: 0.5,
  };
}

/**
 * What goes under the photographs on an ordinary page.
 *
 * Always something. The page used to have a four-in-ten chance of nothing at
 * all under it, which on a page of two prints is a large field of plain cream
 * with two rectangles on it — the emptiest thing in the book, and the reason
 * the design read as unfinished rather than as restrained.
 */
function backingPaper(random: () => number, palette: BookPalette): Shape[] {
  const scraps: Shape[] = [paperScrap(random, palette)];
  if (random() < 0.45) scraps.push(paperStrip(random, palette));
  // A second corner, opposite the first, on the pages with room to show it.
  else if (random() < 0.5) {
    const first = scraps[0] as RectShape;
    const opposite = first.cx < 0.5 ? (first.cy < 0.5 ? 3 : 1) : first.cy < 0.5 ? 2 : 0;
    scraps.push(paperScrap(random, palette, opposite));
  }
  return scraps;
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
  // Between the corners and the middle of each edge. A page whose prints
  // reach the corners used to have nowhere left to draw, so it went bare;
  // these are the gaps such a page actually leaves.
  [0.22, 0.075],
  [0.78, 0.075],
  [0.22, 0.925],
  [0.78, 0.925],
  [0.07, 0.25],
  [0.93, 0.25],
  [0.07, 0.75],
  [0.93, 0.75],
];

/**
 * The marks an owner makes in the margins of an album: a paw, a bone, a
 * supper bowl, the rosette from the one show they entered, a heart or a star
 * stuck on and left slightly crooked.
 *
 * Kept to spare corners and never over a photograph — the whole point of a
 * doodle is that it fills a gap the pictures left.
 */
const DOODLE_KINDS: readonly DoodleKind[] = [
  "heart",
  "star",
  "sparkle",
  "paw",
  "paw",
  "bone",
  "pup",
  "bowl",
  "rosette",
  "loop",
  "wave",
];

/** The two shapes that read as stickers rather than as pen marks. */
const STICKER_KINDS = new Set<DoodleKind>(["heart", "star"]);

/** On a page that carries words, the pen sometimes points from them to the photographs. */
const NOTE_DOODLE_KINDS: readonly DoodleKind[] = [...DOODLE_KINDS, "arrow", "arrow"];

/** The arrow path runs down and to the right, about 26° off level. */
const ARROW_BEARING = 26;

/** Turns an arrow at (cx, cy) to point back at the middle of the page. */
function aimedAtCentre(cx: number, cy: number): number {
  const degrees = (Math.atan2(0.5 - cy, 0.5 - cx) * 180) / Math.PI;
  return degrees - ARROW_BEARING;
}

function doodlesFor(
  random: () => number,
  palette: BookPalette,
  occupied: Rotated[],
  count: number,
  kinds: readonly DoodleKind[] = DOODLE_KINDS,
): Doodle[] {
  const doodles: Doodle[] = [];
  const spots = [...DOODLE_SPOTS].sort(() => random() - 0.5);
  for (const [spotX, spotY] of spots) {
    if (doodles.length >= count) break;
    const wanted = between(random, 0.062, 0.1);

    // Pulled in far enough that the binder's knife never takes half a paw.
    const inside = (value: number, size: number): number =>
      Math.min(Math.max(value, DECOR_EDGE + size / 2), 1 - DECOR_EDGE - size / 2);
    const fits = (
      size: number,
      pad: number,
    ): { cx: number; cy: number; size: number } | null => {
      const candidate = { cx: inside(spotX, size), cy: inside(spotY, size), size };
      if (overlaps(candidate, occupied, pad)) return null;
      const drawn = doodles.map((doodle) => ({ ...doodle, w: doodle.size, h: doodle.size }));
      if (overlaps(candidate, drawn, 0.02)) return null;
      return candidate;
    };

    // A page of two wide prints leaves only narrow bands of paper, and a
    // doodle at full size clears none of them — which is how the roomiest
    // layouts in the book ended up the barest. A smaller pen mark fits where
    // a large one does not, and a small mark drawn close to a photograph is
    // what somebody with a pen actually does.
    const placed = fits(wanted, 0.008) ?? fits(wanted * 0.75, 0.008) ?? fits(0.036, 0.003);
    if (!placed) continue;
    const { cx, cy, size } = placed;
    const kind = pick(random, kinds);
    // Hearts and stars are stuck on about half the time: filled in the
    // book's own color with the white edge of a die-cut sticker.
    const sticker = STICKER_KINDS.has(kind) && random() < 0.5;
    doodles.push({
      kind,
      cx,
      cy,
      size: sticker ? size * 0.92 : size,
      // An arrow is drawn to point at something; everything else is just
      // set down at an angle.
      rotation: kind === "arrow" ? aimedAtCentre(cx, cy) : between(random, -18, 18),
      color: sticker ? palette.accent : pick(random, [palette.doodle, palette.doodle, palette.accent]),
      ...(sticker ? { fill: true, outline: CARD } : {}),
    });
  }
  return doodles;
}

function occupiedBy(prints: Print[]): Rotated[] {
  return prints.flatMap((print) => [print, ...print.tapes]);
}

/**
 * How many marks a page gets. Never none: an album page with nothing drawn
 * on it is a page nobody has touched, and the whole look rests on the sense
 * that somebody did.
 */
function doodleCount(random: () => number): number {
  const roll = random();
  return roll < 0.2 ? 2 : roll < 0.7 ? 3 : 4;
}

/* ------------------------------ notes ------------------------------ */

/** Padding inside a note card, points. */
const NOTE_PAD = 17;

/**
 * The owner's words, written on a card and taped to the page.
 *
 * The card hugs what is actually written rather than filling its slot: a
 * two-word note on a full-height column would otherwise print as a large
 * empty box, which is the difference between a scrapbook and a form. Where
 * nothing has been written the card carries the date the photographs were
 * taken, set in the same hand — which is what the page would have said
 * anyway.
 */
function noteCard(args: {
  slot: Slot;
  note: PageNote;
  context: DesignContext;
  random: () => number;
  index: number;
}): { shapes: Shape[]; texts: TextBlock[]; occupied: Rotated[] } {
  const { slot, note, context, random, index } = args;
  const { palette } = context;
  const written = Boolean(note.text);

  const paragraphs = noteParagraphs(note, {
    body: { font: "hand", size: 19, leading: 25, color: palette.ink, maxLines: 12 },
    meta: { font: "sans", size: 8, tracking: 2, uppercase: true, color: palette.accent },
    alone: { font: "hand", size: 23, color: palette.accent },
    align: "center",
  });
  if (paragraphs.length === 0) return { shapes: [], texts: [], occupied: [] };

  // Measured in the card's own inner width and the deepest it could be, so
  // the card that gets drawn is the size of what is actually written.
  const pad = fromPt(NOTE_PAD);
  const words = textHeight({
    x: 0,
    y: 0,
    w: slot.w - pad * 2,
    h: Math.max(slot.h - pad * 2, pad),
    valign: "top",
    paragraphs,
  });
  const cardH = Math.min(slot.h, Math.max(words + pad * 2, fromPt(written ? 78 : 58)));
  const cy = slot.y + slot.h / 2;
  const rotation = (index % 2 === 0 ? -1 : 1) * between(random, 0.6, 2.2);

  // A touch narrower than its slot, so two cards side by side keep a little
  // white between them even once both are tilted.
  const card = keepOnPage(
    {
      cx: slot.x + slot.w / 2,
      cy,
      w: slot.w - Math.min(slot.w * 0.06, fromPt(12)),
      h: cardH,
      rotation,
    },
    DECOR_EDGE,
  );

  // A strip of tape over the card's top edge, a little off centre.
  const held = rotateAround(
    card.cx,
    card.cy,
    between(random, -0.16, 0.16) * card.w,
    -card.h / 2,
    rotation,
  );

  const shapes: Shape[] = [
    // A torn scrap behind it, so the card is not the only white on the page.
    {
      kind: "rect",
      ...card,
      w: card.w + 0.02,
      h: card.h + 0.018,
      rotation: rotation * 2.1,
      fill: pick(random, palette.scraps),
      opacity: 0.55,
    },
    { kind: "rect", ...card, fill: CARD, shadow: true },
    {
      kind: "tape",
      cx: held.x,
      cy: held.y,
      w: Math.min(Math.max(card.w * 0.34, 0.07), 0.13),
      h: 0.03,
      rotation: rotation + between(random, -7, 7),
      color: pick(random, palette.tape),
      opacity: 0.82,
    },
  ];

  const texts: TextBlock[] = [
    {
      x: card.cx - card.w / 2 + pad,
      y: card.cy - card.h / 2 + pad,
      w: card.w - pad * 2,
      h: card.h - pad * 2,
      valign: "middle",
      rotation,
      ...(written ? { ruled: { color: palette.accent, opacity: 0.16 } } : {}),
      paragraphs,
    },
  ];

  return { shapes, texts, occupied: [card] };
}

/* ------------------------------ the date in hand ------------------------------ */

/** Where a date might be written, in the order an owner would reach for. */
const STAMP_SPOTS: readonly [number, number][] = [
  [0.5, 0.945],
  [0.5, 0.075],
  [0.25, 0.945],
  [0.75, 0.945],
  [0.25, 0.075],
  [0.75, 0.075],
];

const STAMP_SIZE = 21;
const STAMP_WIDTH = 0.34;

/**
 * The month, written on the page by hand.
 *
 * A page of three or four photographs said nothing at all. The polaroid pages
 * carry their date on the print's deep bottom edge and the caption pages
 * carry it on the note card, so the grids were the one kind of page in the
 * book with no words on it anywhere — and an album page nobody wrote a date
 * on is a page nobody kept.
 *
 * Set in the same hand as the note cards, in a gap the photographs left, and
 * given back to the caller as an occupied box so the doodles keep off it.
 */
function dateInHand(args: {
  label: string | null;
  context: DesignContext;
  random: () => number;
  occupied: Rotated[];
}): { texts: TextBlock[]; occupied: Rotated[] } {
  const { label, context, random, occupied } = args;
  if (!label) return { texts: [], occupied: [] };

  const height = fromPt(STAMP_SIZE * 1.4);
  // Against the line's own box rather than a square around it. A written
  // date is wide and shallow, and a square the width of one finds nowhere to
  // sit on a page of four photographs — which is exactly the page that most
  // needs a date on it.
  // Pulled inside the decorative edge first, so a spot near the side does not
  // hang the line off the page.
  const place = (at: number): number =>
    Math.min(Math.max(at, DECOR_EDGE + STAMP_WIDTH / 2), 1 - DECOR_EDGE - STAMP_WIDTH / 2);
  const spot = STAMP_SPOTS.map(([cx, cy]): [number, number] => [place(cx), cy]).find(
    ([cx, cy]) => !clashes({ cx, cy, w: STAMP_WIDTH, h: height, rotation: 0 }, occupied, 0.006),
  );
  if (!spot) return { texts: [], occupied: [] };

  const [cx, cy] = spot;
  const rotation = (random() < 0.5 ? -1 : 1) * between(random, 0.8, 2.6);
  return {
    texts: [
      lineAt({
        baseline: cy + fromPt(STAMP_SIZE * 0.32),
        x: cx - STAMP_WIDTH / 2,
        w: STAMP_WIDTH,
        rotation,
        paragraph: {
          text: label,
          font: "hand",
          size: STAMP_SIZE,
          color: context.palette.accent,
          align: "center",
        },
      }),
    ],
    occupied: [{ cx, cy, w: STAMP_WIDTH, h: height, rotation }],
  };
}

/** Whether two boxes come within `pad` of one another, once both are turned. */
function clashes(box: Rotated, boxes: readonly Rotated[], pad: number): boolean {
  const mine = rotatedHalfExtents(box);
  return boxes.some((other) => {
    const theirs = rotatedHalfExtents(other);
    return (
      Math.abs(box.cx - other.cx) < mine.hw + theirs.hw + pad &&
      Math.abs(box.cy - other.cy) < mine.hh + theirs.hh + pad
    );
  });
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
      design.under = [
        // Torn paper behind the name, so the emptiest page in the book is not
        // a name floating over cream.
        {
          kind: "rect",
          cx: 0.5,
          cy: 0.215,
          w: between(random, 0.76, 0.86),
          h: between(random, 0.15, 0.185),
          rotation: (random() < 0.5 ? -1 : 1) * between(random, 1, 2.4),
          fill: pick(random, palette.scraps),
          opacity: 0.45,
        },
      ];
      design.prints = [print];
      design.over = [
        {
          kind: "tape",
          cx: between(random, 0.11, 0.17),
          cy: between(random, 0.145, 0.175),
          w: 0.12,
          h: 0.032,
          rotation: -34 + between(random, -6, 6),
          color: pick(random, palette.tape),
          opacity: 0.8,
        },
      ];
      design.doodles = doodlesFor(
        random,
        palette,
        [...occupiedBy([print]), { cx: 0.5, cy: 0.23, w: 0.78, h: 0.24, rotation: 0 }],
        4,
        ["sparkle", "heart", "star", "paw"],
      );
      design.texts = titleTexts(context);
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
        2,
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
      design.under = [paperScrap(random, palette)];
      design.prints = [print];
      design.doodles = doodlesFor(
        random,
        palette,
        [...occupiedBy([print]), { cx: 0.5, cy: 0.885, w: 0.7, h: 0.08, rotation: 0 }],
        3,
        ["heart", "sparkle", "paw", "star"],
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
  if (!isPhotoLayout(page.layoutId)) return design;
  if (page.photoIds.length === 0) return design;
  if (isCaptionLayout(page.layoutId)) return captionPage(page, context, random, design);

  const polaroid = page.photoIds.length <= 2;
  const photoId = page.photoIds[0];
  const orientation = photoId ? context.orientationOf(photoId) : undefined;
  const { palette } = context;

  let prints: Print[];
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
    doodles = 3;
  } else {
    const slots = gridSlots(page.layoutId, CONTENT, GRID);
    prints = page.photoIds.flatMap((id, index) => {
      const slot = slots[index];
      return slot ? [slotPrint({ slot, photoId: id, context, random, index, polaroid })] : [];
    });
  }

  design.under = backingPaper(random, palette);
  design.prints = prints;

  // Nothing else on this page says when it was, so the page says it: the
  // prints here carry no date of their own, and the layout keeps no room for
  // the owner's words.
  const written = polaroid
    ? { texts: [], occupied: [] }
    : dateInHand({
        label: (photoId ? context.captionOf(photoId) : null) ?? context.chapter?.dateLabel ?? null,
        context,
        random,
        occupied: occupiedBy(prints),
      });
  design.texts = written.texts;
  design.doodles = doodlesFor(
    random,
    palette,
    [...occupiedBy(prints), ...written.occupied],
    doodles,
  );
  return design;
}

/**
 * A page that keeps room for the owner's words: the photographs on one side
 * of the page and a note card taped to the other.
 *
 * The prints lose their polaroid border here. The date is already on the
 * card, and a page carrying both reads as a page that could not decide.
 */
function captionPage(
  page: BookPage,
  context: DesignContext,
  random: () => number,
  design: PageDesign,
): PageDesign {
  const layoutId = page.layoutId as PhotoLayoutId;
  const { palette } = context;
  const regions = layoutRegions(layoutId, CONTENT, GRID);

  const prints = page.photoIds.flatMap((id, index) => {
    const slot = regions.photos[index];
    return slot ? [slotPrint({ slot, photoId: id, context, random, index, polaroid: false })] : [];
  });

  const notes = pageNotes(page, context);
  const under: Shape[] = [];
  const texts: TextBlock[] = [];
  const cards: Rotated[] = [];

  notes.forEach((note, index) => {
    const slot = regions.texts[index];
    if (!slot || isEmptyNote(note)) return;
    const card = noteCard({ slot, note, context, random, index });
    under.push(...card.shapes);
    texts.push(...card.texts);
    cards.push(...card.occupied);
  });

  // Torn paper under it, as on any other page: the note cards are white, and
  // a page of white cards on cream needs some color beneath them.
  design.under = [...backingPaper(random, palette), ...under];
  design.prints = prints;
  design.texts = texts;
  design.doodles = doodlesFor(
    random,
    palette,
    [...occupiedBy(prints), ...cards],
    doodleCount(random),
    NOTE_DOODLE_KINDS,
  );
  return design;
}

export const scrapbook: BookDesign = {
  id: "scrapbook",
  name: "Scrapbook",
  tagline: "Polaroids, washi tape and doodles.",
  designPage,
};
