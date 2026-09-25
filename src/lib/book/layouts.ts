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
 * running off the edge — but not how many photos it holds or which way they
 * face. That contract is what makes the design a pure restyling. Switching
 * from Scrapbook to Modern never moves a photo to another page, and a layout
 * the customer picked for a page means the same thing in every design.
 *
 * Ten layouts, one to six photos. `slotShapes` is the orientation each slot
 * suits, used to deal photos into layouts and slots automatically; a design's
 * own slot geometry must keep to it.
 */
export type PhotoLayoutSpec = {
  id: PhotoLayoutId;
  photoCount: number;
  /** What the customer sees in the layout picker. */
  label: string;
  slotShapes: SlotShape[];
};

export const PHOTO_LAYOUTS: readonly PhotoLayoutSpec[] = [
  { id: "full-bleed", photoCount: 1, label: "One large", slotShapes: ["any"] },
  { id: "single-framed", photoCount: 1, label: "One, with room", slotShapes: ["any"] },
  { id: "two-vertical", photoCount: 2, label: "Two side by side", slotShapes: ["portrait", "portrait"] },
  { id: "two-horizontal", photoCount: 2, label: "Two stacked", slotShapes: ["landscape", "landscape"] },
  {
    id: "one-large-two-small",
    photoCount: 3,
    label: "One big, two small",
    slotShapes: ["portrait", "landscape", "landscape"],
  },
  { id: "three-editorial", photoCount: 3, label: "One wide, two below", slotShapes: ["landscape", "any", "any"] },
  { id: "four-grid", photoCount: 4, label: "Grid of four", slotShapes: ["any", "any", "any", "any"] },
  {
    id: "one-large-three-small",
    photoCount: 4,
    label: "One big, three small",
    slotShapes: ["portrait", "any", "any", "any"],
  },
  {
    id: "five-mosaic",
    photoCount: 5,
    label: "Mosaic of five",
    slotShapes: ["landscape", "landscape", "portrait", "portrait", "portrait"],
  },
  {
    id: "six-grid",
    photoCount: 6,
    label: "Grid of six",
    slotShapes: ["portrait", "portrait", "portrait", "portrait", "portrait", "portrait"],
  },
];

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
};

/**
 * Slots for any of the ten layouts, laid out in `frame` with `gutter` between
 * them. Designs call this with their own margins and proportions rather than
 * hand-writing sixty rectangles; the slot order always matches the layout's
 * `slotShapes`.
 */
export function gridSlots(id: PhotoLayoutId, frame: Frame, options: GridOptions): Slot[] {
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
  }
}

/* ------------------------------ choosing ------------------------------ */

/**
 * Picks the layout whose slot shapes best match the photos being placed,
 * while refusing to use the same layout more than twice in a row.
 */
export function chooseLayout(
  orientations: PhotoOrientation[],
  recentLayoutIds: LayoutId[],
): PhotoLayoutId {
  const candidates = layoutsForCount(orientations.length);
  const blocked = lastTwoAreSame(recentLayoutIds) ? recentLayoutIds.at(-1) : null;

  const allowed = candidates.filter((id) => id !== blocked);
  const pool = allowed.length > 0 ? allowed : candidates;

  let best = pool[0]!;
  let bestScore = -Infinity;
  for (const id of pool) {
    const score = shapeScore(photoLayoutSpec(id).slotShapes, orientations);
    if (score > bestScore) {
      best = id;
      bestScore = score;
    }
  }
  return best;
}

function lastTwoAreSame(ids: LayoutId[]): boolean {
  return ids.length >= 2 && ids.at(-1) === ids.at(-2);
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
