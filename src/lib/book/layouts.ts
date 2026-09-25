import type { LayoutId, PhotoLayoutId, Slot, SlotShape } from "@/types/book";
import type { Orientation as PhotoOrientation } from "@/types/photo";

/**
 * Page geometry. The interior PDF page is 8.75 x 8.75 in: an 8.5 in trim plus
 * 0.125 in bleed on every edge. All slots below are normalized against the
 * full 8.75 in page.
 */
export const TRIM_INCHES = 8.5;
export const BLEED_INCHES = 0.125;
export const PAGE_INCHES = TRIM_INCHES + BLEED_INCHES * 2;

/** Lulu recommends 0.5 in from trim; 0.625 in from the document edge. */
export const SAFE_INCHES = 0.625;

/** The safe margin and a standard gutter, normalized. */
export const SAFE = SAFE_INCHES / PAGE_INCHES; // ~0.0714
export const STANDARD_GUTTER = 0.19 / PAGE_INCHES; // ~0.0217

/**
 * The photo-page layouts every design offers.
 *
 * One catalogue, shared by all four designs: a design decides what "two side
 * by side" looks like — tilted polaroids, a clean matted pair, two photos
 * running off the edge — but not how many photos it holds, which way they
 * face, or whether the page keeps room for words. That contract is what makes
 * the design a pure restyling. Switching from Scrapbook to Modern never moves
 * a photo to another page, and a layout the customer picked for a page means
 * the same thing in every design.
 *
 * Twenty-two layouts, one to six photos. Ten are photographs alone; the
 * twelve `caption-*` layouts hold one to four photos and keep room for the
 * owner's own words to the right, to the left, or underneath. A page never
 * carries more than two notes — one per photo up to two, and a single note
 * for the busier pages, because a page of pictures with four captions on it
 * is a form, not a page.
 *
 * `slotShapes` is the orientation each slot suits, used to deal photos into
 * layouts and slots automatically; a design's own slot geometry must keep to
 * it.
 */
export type PhotoLayoutSpec = {
  id: PhotoLayoutId;
  photoCount: number;
  /** What the customer sees in the layout picker. */
  label: string;
  slotShapes: SlotShape[];
  /** Note slots the page keeps room for: 0, 1 or 2. */
  noteCount: number;
  /** Where those notes sit, on the layouts that have them. */
  notesAt?: NotePlacement;
};

export type NotePlacement = "right" | "left" | "below";

const COUNT_WORD = ["", "One", "Two", "Three", "Four"];

/** "Two photos, words beside" — one label rule for all twelve. */
function captionLabel(count: number, at: NotePlacement): string {
  const photos = count === 1 ? "One photo" : `${COUNT_WORD[count]} photos`;
  const words = at === "below" ? "words below" : `words ${at}`;
  return `${photos}, ${words}`;
}

/**
 * One note per photo, capped at two: a page with one photo gets one note, a
 * pair gets a note each, and three or four share a single one.
 */
function noteCountFor(photoCount: number): number {
  return photoCount === 2 ? 2 : 1;
}

const CAPTION_COUNTS = [1, 2, 3, 4] as const;
const CAPTION_PLACEMENTS: readonly NotePlacement[] = ["right", "left", "below"];

/** The shape each photo slot suits, per caption layout. */
function captionShapes(count: number, at: NotePlacement): SlotShape[] {
  if (at === "below") {
    if (count === 1) return ["landscape"];
    if (count === 2) return ["portrait", "portrait"];
    if (count === 3) return ["portrait", "portrait", "portrait"];
    return ["any", "any", "any", "any"];
  }
  if (count === 1) return ["portrait"];
  if (count === 2) return ["landscape", "landscape"];
  if (count === 3) return ["landscape", "landscape", "landscape"];
  return ["any", "any", "any", "any"];
}

const CAPTION_LAYOUTS: readonly PhotoLayoutSpec[] = CAPTION_PLACEMENTS.flatMap((at) =>
  CAPTION_COUNTS.map((count) => ({
    id: `caption-${at}-${count}` as PhotoLayoutId,
    photoCount: count,
    label: captionLabel(count, at),
    slotShapes: captionShapes(count, at),
    noteCount: noteCountFor(count),
    notesAt: at,
  })),
);

export const PHOTO_LAYOUTS: readonly PhotoLayoutSpec[] = [
  { id: "full-bleed", photoCount: 1, label: "One large", slotShapes: ["any"], noteCount: 0 },
  { id: "single-framed", photoCount: 1, label: "One, with room", slotShapes: ["any"], noteCount: 0 },
  { id: "two-vertical", photoCount: 2, label: "Two side by side", slotShapes: ["portrait", "portrait"], noteCount: 0 },
  { id: "two-horizontal", photoCount: 2, label: "Two stacked", slotShapes: ["landscape", "landscape"], noteCount: 0 },
  {
    id: "one-large-two-small",
    photoCount: 3,
    label: "One big, two small",
    slotShapes: ["portrait", "landscape", "landscape"],
    noteCount: 0,
  },
  {
    id: "three-editorial",
    photoCount: 3,
    label: "One wide, two below",
    slotShapes: ["landscape", "any", "any"],
    noteCount: 0,
  },
  { id: "four-grid", photoCount: 4, label: "Grid of four", slotShapes: ["any", "any", "any", "any"], noteCount: 0 },
  {
    id: "one-large-three-small",
    photoCount: 4,
    label: "One big, three small",
    slotShapes: ["portrait", "any", "any", "any"],
    noteCount: 0,
  },
  {
    id: "five-mosaic",
    photoCount: 5,
    label: "Mosaic of five",
    slotShapes: ["landscape", "landscape", "portrait", "portrait", "portrait"],
    noteCount: 0,
  },
  {
    id: "six-grid",
    photoCount: 6,
    label: "Grid of six",
    slotShapes: ["portrait", "portrait", "portrait", "portrait", "portrait", "portrait"],
    noteCount: 0,
  },
  ...CAPTION_LAYOUTS,
];

/** The most notes any one page can carry. */
export const MAX_NOTES_PER_PAGE = 2;

export const MAX_PHOTOS_PER_PAGE = 6;

const SPECS = new Map(PHOTO_LAYOUTS.map((spec) => [spec.id, spec]));

export function isPhotoLayout(id: LayoutId | null | undefined): id is PhotoLayoutId {
  return Boolean(id && SPECS.has(id as PhotoLayoutId));
}

export function photoLayoutSpec(id: PhotoLayoutId): PhotoLayoutSpec {
  return SPECS.get(id)!;
}

export function layoutPhotoCount(id: PhotoLayoutId): number {
  return photoLayoutSpec(id).photoCount;
}

export function layoutsForCount(count: number): PhotoLayoutId[] {
  const clamped = Math.min(Math.max(count, 1), MAX_PHOTOS_PER_PAGE);
  return PHOTO_LAYOUTS.filter((spec) => spec.photoCount === clamped).map((spec) => spec.id);
}

/** How many notes this layout keeps room for — 0 on the photographs-only ten. */
export function layoutNoteCount(id: LayoutId | null | undefined): number {
  return isPhotoLayout(id) ? photoLayoutSpec(id).noteCount : 0;
}

/** True for a layout that keeps room for the owner's words. */
export function isCaptionLayout(id: LayoutId | null | undefined): boolean {
  return isPhotoLayout(id) && photoLayoutSpec(id).noteCount > 0;
}

/** Where a layout's notes sit, or null on a layout with none. */
export function notePlacement(id: PhotoLayoutId): NotePlacement | null {
  return photoLayoutSpec(id).notesAt ?? null;
}

/** The photographs-only layouts, then the ones that hold words. */
export function layoutGroups(): { label: string; layouts: PhotoLayoutSpec[] }[] {
  return [
    { label: "Photos", layouts: PHOTO_LAYOUTS.filter((spec) => spec.noteCount === 0) },
    { label: "Photos and words", layouts: PHOTO_LAYOUTS.filter((spec) => spec.noteCount > 0) },
  ];
}

/* ------------------------------ geometry ------------------------------ */

/** The rectangle a design lays photos out in, normalized, top-left anchored. */
export type Frame = Slot;

export type GridOptions = {
  /** Space between photos, normalized. */
  gutter: number;
  /** Share of the width the big photo takes in the "one big" layouts. */
  feature?: number;
  /** Share of the height the wide photo takes in "one wide, two below". */
  lead?: number;
  /** Share of the height the top row takes in the mosaic. */
  mosaicTop?: number;
  /** The single photo "with room", as a share of the frame. */
  framed?: { w: number; h: number; y?: number };
  /**
   * Share of the frame the words take on a `caption-*` layout: of the width
   * when they sit beside the photos, of the height when they sit below.
   */
  noteShare?: number;
  /** Space between the photos and the words, normalized. Defaults to 1.6 gutters. */
  noteGap?: number;
  /**
   * Pulls the words in from the frame's edge — for a design whose photos run
   * off the page but whose type must not.
   */
  noteInset?: number;
};

/**
 * Where a layout's photographs and its words go, laid out in `frame`.
 *
 * Designs call this with their own margins and proportions rather than
 * hand-writing two hundred rectangles; the photo order always matches the
 * layout's `slotShapes`, and `texts` is empty on the layouts that hold none.
 */
export type LayoutRegions = { photos: Slot[]; texts: Slot[] };

export function layoutRegions(
  id: PhotoLayoutId,
  frame: Frame,
  options: GridOptions,
): LayoutRegions {
  const spec = photoLayoutSpec(id);
  if (!spec.notesAt) return { photos: gridSlots(id, frame, options), texts: [] };
  return captionRegions(spec, frame, options);
}

/**
 * A caption layout: the photographs take most of the frame and the words take
 * a column beside them or a band below. Where there are exactly two of each,
 * every note is set against its own photograph.
 */
function captionRegions(spec: PhotoLayoutSpec, frame: Frame, options: GridOptions): LayoutRegions {
  const at = spec.notesAt!;
  const g = options.gutter;
  const gap = options.noteGap ?? g * 1.6;
  const inset = options.noteInset ?? 0;
  const share = options.noteShare ?? (at === "below" ? 0.26 : 0.34);

  const photoArea: Slot =
    at === "below"
      ? { ...frame, h: frame.h * (1 - share) - gap }
      : {
          x: at === "left" ? frame.x + frame.w * share + gap : frame.x,
          y: frame.y,
          w: frame.w * (1 - share) - gap,
          h: frame.h,
        };

  // The inset is taken off whichever sides face the edge of the page: a
  // design whose photographs bleed off the paper must still keep its words
  // where the binder's knife cannot reach them.
  const noteArea: Slot =
    at === "below"
      ? {
          x: frame.x + inset,
          y: frame.y + frame.h * (1 - share),
          w: frame.w - inset * 2,
          h: frame.h * share - inset,
        }
      : {
          x: at === "left" ? frame.x + inset : frame.x + frame.w * (1 - share),
          y: frame.y + inset,
          w: frame.w * share - inset,
          h: frame.h - inset * 2,
        };

  const photos = captionPhotoSlots(spec.photoCount, at, photoArea, g);

  // One note beside each photo when there are two of each; otherwise a single
  // note, held to the middle of its column so it does not float in a corner.
  const texts: Slot[] =
    spec.noteCount === 2
      ? photos.map((slot) =>
          at === "below"
            ? clampAcross(slot, noteArea)
            : clampDown(slot, noteArea),
        )
      : [noteArea];

  return { photos, texts };
}

/** A note under its own photograph, never wider than the band it sits in. */
function clampAcross(slot: Slot, area: Slot): Slot {
  const left = Math.max(slot.x, area.x);
  const right = Math.min(slot.x + slot.w, area.x + area.w);
  return { x: left, y: area.y, w: Math.max(0, right - left), h: area.h };
}

/** A note beside its own photograph, never taller than the column it sits in. */
function clampDown(slot: Slot, area: Slot): Slot {
  const top = Math.max(slot.y, area.y);
  const bottom = Math.min(slot.y + slot.h, area.y + area.h);
  return { x: area.x, y: top, w: area.w, h: Math.max(0, bottom - top) };
}

/** The photographs of a caption layout inside the area left for them. */
function captionPhotoSlots(count: number, at: NotePlacement, area: Slot, g: number): Slot[] {
  const { x, y, w, h } = area;
  const columns = (n: number): Slot[] => {
    const cell = (w - g * (n - 1)) / n;
    return Array.from({ length: n }, (_, index) => ({ x: x + index * (cell + g), y, w: cell, h }));
  };
  const rows = (n: number): Slot[] => {
    const cell = (h - g * (n - 1)) / n;
    return Array.from({ length: n }, (_, index) => ({ x, y: y + index * (cell + g), w, h: cell }));
  };
  const quad = (): Slot[] => {
    const halfW = (w - g) / 2;
    const halfH = (h - g) / 2;
    return [
      { x, y, w: halfW, h: halfH },
      { x: x + halfW + g, y, w: halfW, h: halfH },
      { x, y: y + halfH + g, w: halfW, h: halfH },
      { x: x + halfW + g, y: y + halfH + g, w: halfW, h: halfH },
    ];
  };

  if (count === 1) return [{ ...area }];
  if (count === 4) return quad();
  // Beside the words the photos stack; under them they run across.
  return at === "below" ? columns(count) : rows(count);
}

/**
 * Slots for any of the layouts, laid out in `frame` with `gutter` between
 * them — the photographs only. `layoutRegions` is the way to get a caption
 * layout's words as well.
 */
export function gridSlots(id: PhotoLayoutId, frame: Frame, options: GridOptions): Slot[] {
  const spec = photoLayoutSpec(id);
  if (spec.notesAt) return captionRegions(spec, frame, options).photos;
  const { x, y, w, h } = frame;
  const g = options.gutter;
  const halfW = (w - g) / 2;
  const halfH = (h - g) / 2;

  const columns = (count: number, top: number, height: number): Slot[] => {
    const cell = (w - g * (count - 1)) / count;
    return Array.from({ length: count }, (_, index) => ({ x: x + index * (cell + g), y: top, w: cell, h: height }));
  };
  const stack = (count: number, left: number, width: number): Slot[] => {
    const cell = (h - g * (count - 1)) / count;
    return Array.from({ length: count }, (_, index) => ({ x: left, y: y + index * (cell + g), w: width, h: cell }));
  };

  switch (id) {
    case "full-bleed":
      return [{ ...frame }];

    case "single-framed": {
      const share = options.framed ?? { w: 0.72, h: 0.72 };
      const fw = w * share.w;
      const fh = h * share.h;
      return [{ x: x + (w - fw) / 2, y: y + (share.y ?? (h - fh) / 2 / h) * h, w: fw, h: fh }];
    }

    case "two-vertical":
      return columns(2, y, h);

    case "two-horizontal":
      return stack(2, x, w);

    case "one-large-two-small":
    case "one-large-three-small": {
      const big = w * (options.feature ?? 0.65);
      const rest = w - big - g;
      return [
        { x, y, w: big, h },
        ...stack(id === "one-large-two-small" ? 2 : 3, x + big + g, rest),
      ];
    }

    case "three-editorial": {
      const top = h * (options.lead ?? 0.563);
      const below = h - top - g;
      return [{ x, y, w, h: top }, ...columns(2, y + top + g, below)];
    }

    case "four-grid":
      return [
        { x, y, w: halfW, h: halfH },
        { x: x + halfW + g, y, w: halfW, h: halfH },
        { x, y: y + halfH + g, w: halfW, h: halfH },
        { x: x + halfW + g, y: y + halfH + g, w: halfW, h: halfH },
      ];

    case "five-mosaic": {
      const top = (h - g) * (options.mosaicTop ?? 0.45);
      const below = h - top - g;
      return [...columns(2, y, top), ...columns(3, y + top + g, below)];
    }

    case "six-grid":
      return [...columns(3, y, halfH), ...columns(3, y + halfH + g, halfH)];

    default:
      // Caption layouts are handled above; nothing else reaches here.
      return [{ ...frame }];
  }
}

/* ------------------------------ choosing ------------------------------ */

/** How many recent pages a layout has to stay away from before it comes round again. */
const VARIETY_WINDOW = 6;

/** Deterministic 0..1 from a string — same page, same book, same choice. */
export function seededUnit(seed: string): number {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return ((hash >>> 0) % 1000) / 1000;
}

export type LayoutChoice = {
  /** The layouts the last few pages used, most recent last. */
  recent: LayoutId[];
  /** Stable per page, so the same book always deals the same layouts. */
  seed?: string;
  /** Whether this page should keep room for the owner's words. */
  wantsWords?: boolean;
};

/**
 * Picks the layout for a page the book is laying out itself.
 *
 * Three things decide it, in this order of weight: how well the layout's
 * slots suit the shapes of the photographs going into them, how long it has
 * been since the book last used it, and whether this page is one of the ones
 * meant to carry words. The variety term is what stops a book of landscape
 * photographs from printing "two stacked" eleven times in a row — the failing
 * that made the free preview look like a template rather than a book.
 */
export function chooseLayout(
  orientations: PhotoOrientation[],
  choice: LayoutChoice,
): PhotoLayoutId {
  const { recent, seed, wantsWords } = choice;
  const candidates = layoutsForCount(orientations.length);

  let best = candidates[0]!;
  let bestScore = -Infinity;
  for (const id of candidates) {
    const spec = photoLayoutSpec(id);
    const shape = shapeScore(spec.slotShapes, orientations);
    const since = recent.lastIndexOf(id);
    const staleness = since === -1 ? VARIETY_WINDOW : recent.length - 1 - since;
    const repeat = Math.max(0, VARIETY_WINDOW - staleness) * 0.75;
    // A second caption page in a row reads as a chapter of captions.
    const lastWasWords = isCaptionLayout(recent.at(-1));
    const words =
      spec.noteCount > 0
        ? (wantsWords ? 2.2 : -2.6) + (lastWasWords ? -1.4 : 0)
        : wantsWords
          ? -1.4
          : 0;
    const score = shape + words - repeat + seededUnit(`${seed ?? ""}:${id}`) * 0.5;
    if (score > bestScore) {
      best = id;
      bestScore = score;
    }
  }
  return best;
}

function shapeScore(shapes: SlotShape[], orientations: PhotoOrientation[]): number {
  let score = 0;
  for (let i = 0; i < shapes.length; i += 1) {
    const shape = shapes[i];
    const orientation = orientations[i];
    if (!orientation) continue;
    if (shape === "any") score += 0.5;
    else if (shape === orientation) score += 1;
    else if (shape === "square" || orientation === "square") score += 0.25;
  }
  return score;
}

/**
 * Orders photos so each one lands in the slot that suits its shape, without
 * changing which photos appear on the page.
 */
export function assignToSlots(
  layoutId: PhotoLayoutId,
  photos: { id: string; orientation: PhotoOrientation }[],
): string[] {
  const shapes = photoLayoutSpec(layoutId).slotShapes;
  const remaining = [...photos];
  const assigned: string[] = [];

  for (const shape of shapes) {
    if (remaining.length === 0) break;
    let pick = 0;
    if (shape !== "any") {
      const match = remaining.findIndex((photo) => photo.orientation === shape);
      if (match !== -1) pick = match;
    }
    assigned.push(remaining.splice(pick, 1)[0]!.id);
  }

  for (const leftover of remaining) assigned.push(leftover.id);
  return assigned;
}
