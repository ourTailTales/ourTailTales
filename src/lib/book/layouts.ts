import type { LayoutDefinition, LayoutId, SlotShape } from "@/types/book";
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

const M = SAFE_INCHES / PAGE_INCHES; // ~0.0714
const GUTTER = 0.19 / PAGE_INCHES; // ~0.0217
const CONTENT = 1 - M * 2;

const HALF = (CONTENT - GUTTER) / 2;

export const LAYOUTS: Record<LayoutId, LayoutDefinition> = {
  "full-bleed": {
    id: "full-bleed",
    slots: [{ x: 0, y: 0, w: 1, h: 1 }],
    slotShapes: ["any"],
    fullBleed: true,
  },

  "two-vertical": {
    id: "two-vertical",
    slots: [
      { x: M, y: M, w: HALF, h: CONTENT },
      { x: M + HALF + GUTTER, y: M, w: HALF, h: CONTENT },
    ],
    slotShapes: ["portrait", "portrait"],
  },

  "two-horizontal": {
    id: "two-horizontal",
    slots: [
      { x: M, y: M, w: CONTENT, h: HALF },
      { x: M, y: M + HALF + GUTTER, w: CONTENT, h: HALF },
    ],
    slotShapes: ["landscape", "landscape"],
  },

  "one-large-two-small": {
    id: "one-large-two-small",
    slots: [
      { x: M, y: M, w: 0.5576, h: CONTENT },
      { x: M + 0.5576 + GUTTER, y: M, w: CONTENT - 0.5576 - GUTTER, h: HALF },
      {
        x: M + 0.5576 + GUTTER,
        y: M + HALF + GUTTER,
        w: CONTENT - 0.5576 - GUTTER,
        h: HALF,
      },
    ],
    slotShapes: ["portrait", "landscape", "landscape"],
  },

  "three-editorial": {
    id: "three-editorial",
    slots: [
      { x: M, y: M, w: CONTENT, h: 0.4826 },
      { x: M, y: M + 0.4826 + GUTTER, w: HALF, h: CONTENT - 0.4826 - GUTTER },
      {
        x: M + HALF + GUTTER,
        y: M + 0.4826 + GUTTER,
        w: HALF,
        h: CONTENT - 0.4826 - GUTTER,
      },
    ],
    slotShapes: ["landscape", "any", "any"],
  },

  "four-grid": {
    id: "four-grid",
    slots: [
      { x: M, y: M, w: HALF, h: HALF },
      { x: M + HALF + GUTTER, y: M, w: HALF, h: HALF },
      { x: M, y: M + HALF + GUTTER, w: HALF, h: HALF },
      { x: M + HALF + GUTTER, y: M + HALF + GUTTER, w: HALF, h: HALF },
    ],
    slotShapes: ["any", "any", "any", "any"],
  },

  /** Text block above a hero image that bleeds off the bottom and sides. */
  "chapter-opener": {
    id: "chapter-opener",
    slots: [{ x: 0, y: 0.44, w: 1, h: 0.56 }],
    slotShapes: ["landscape"],
    textBox: { x: M, y: M, w: CONTENT, h: 0.44 - M - 0.02 },
  },
};

/**
 * Geometry for the four fixed pages, shared by the on-screen preview and the
 * print PDF so what the customer sees is what gets bound.
 */
export const FIXED_SLOTS = {
  titleHero: { x: 0.24, y: 0.5, w: 0.52, h: 0.3 },
  closingHero: { x: 0, y: 0, w: 1, h: 0.78 },
} as const;

const PHOTO_LAYOUTS_BY_COUNT: Record<number, LayoutId[]> = {
  1: ["full-bleed"],
  2: ["two-horizontal", "two-vertical"],
  3: ["one-large-two-small", "three-editorial"],
  4: ["four-grid"],
};

export function layoutsForCount(count: number): LayoutId[] {
  return PHOTO_LAYOUTS_BY_COUNT[count] ?? PHOTO_LAYOUTS_BY_COUNT[2];
}

/**
 * Picks the layout whose slot shapes best match the photos being placed,
 * while refusing to use the same layout more than twice in a row.
 */
export function chooseLayout(
  orientations: PhotoOrientation[],
  recentLayoutIds: LayoutId[],
): LayoutId {
  const candidates = layoutsForCount(orientations.length);
  const blocked = lastTwoAreSame(recentLayoutIds) ? recentLayoutIds.at(-1) : null;

  const allowed = candidates.filter((id) => id !== blocked);
  const pool = allowed.length > 0 ? allowed : candidates;

  let best = pool[0];
  let bestScore = -Infinity;
  for (const id of pool) {
    const score = shapeScore(LAYOUTS[id].slotShapes, orientations);
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
  layoutId: LayoutId,
  photos: { id: string; orientation: PhotoOrientation }[],
): string[] {
  const shapes = LAYOUTS[layoutId].slotShapes;
  const remaining = [...photos];
  const assigned: string[] = [];

  for (const shape of shapes) {
    if (remaining.length === 0) break;
    let pick = 0;
    if (shape !== "any") {
      const match = remaining.findIndex((photo) => photo.orientation === shape);
      if (match !== -1) pick = match;
    }
    assigned.push(remaining.splice(pick, 1)[0].id);
  }

  for (const leftover of remaining) assigned.push(leftover.id);
  return assigned;
}
