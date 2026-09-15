import type { Corner, FlipFace, FlipSheet, FoldGeometry, Point, TurnDirection } from "./types";

/** Design-space page size (CSS px before uniform scale). */
export const PAGE_WIDTH = 640;
export const PAGE_HEIGHT = 640;
export const BOOK_WIDTH = PAGE_WIDTH * 2;
export const BOOK_HEIGHT = PAGE_HEIGHT;

/** How much of the empty left page peeks when the right page is centered. */
export const LEFT_PAGE_PEEK = Math.round(PAGE_WIDTH * 0.18);

export const SCENE_PERSPECTIVE = 2400;

export const COVER_OPEN_MS = 1720;
/** Landing hero cover spring — slow start, fast swing, diminishing bounces. */
export const HERO_COVER_SPRING_MS = 2800;
export const HERO_COVER_CLOSE_MS = 1200;
export const SOFT_TURN_MS = 700;
export const CORNER_ZONE = 72;
/** Right-page click-to-turn band left open by the upload overlay. */
export const EDGE_PEEL_ZONE = 0.28;

/**
 * Single-page view (cover / first leaf): shift so the right page sits in the
 * focus frame with a sliver of the empty left page peeking from the left.
 */
export function singlePageOffset(pageWidth = PAGE_WIDTH, peek = LEFT_PAGE_PEEK): number {
  return -(pageWidth - peek);
}

/** @deprecated use singlePageOffset — kept for call sites during cover anim */
export function closedBookOffset(pageWidth = PAGE_WIDTH): number {
  return singlePageOffset(pageWidth);
}

export function openBookOffset(): number {
  return 0;
}

/** Visible frame width while the right page is centered. */
export function singlePageFrameWidth(
  pageWidth = PAGE_WIDTH,
  peek = LEFT_PAGE_PEEK,
): number {
  return pageWidth + peek;
}

/**
 * Cover (page 0) is always a single right-page frame.
 * When `preferSingleFirstLeaf` is set, every open funnel page keeps a blank
 * left leaf — content lives on the right only.
 */
export function isSinglePageView(
  currentPage: number,
  preferSingleFirstLeaf = true,
): boolean {
  if (currentPage <= 0) return true;
  return preferSingleFirstLeaf;
}

/** Flatten sheets into ordered faces: front then back per leaf. */
export function sheetsToFaces(sheets: FlipSheet[]): FlipFace[] {
  const faces: FlipFace[] = [];
  for (const sheet of sheets) {
    faces.push({
      id: `${sheet.id}:front`,
      sheetId: sheet.id,
      kind: sheet.kind,
      side: "front",
      content: sheet.front,
    });
    faces.push({
      id: `${sheet.id}:back`,
      sheetId: sheet.id,
      kind: sheet.kind,
      side: "back",
      content: sheet.back ?? null,
    });
  }
  return faces;
}

/**
 * `currentPage` is the index of the left face of the open spread.
 * `0` means closed (only face 0 — cover front — visible on the right slot).
 *
 * Open first spread: currentPage = 1 → left face 1, right face 2.
 * Next: currentPage = 3 → left 3, right 4.
 */
export function isClosed(currentPage: number): boolean {
  return currentPage <= 0;
}

export function getVisibleFaces(
  faces: FlipFace[],
  currentPage: number,
): { left: FlipFace | null; right: FlipFace | null } {
  if (isClosed(currentPage)) {
    return { left: null, right: faces[0] ?? null };
  }
  return {
    left: faces[currentPage] ?? null,
    right: faces[currentPage + 1] ?? null,
  };
}

export function canGoForward(
  faces: FlipFace[],
  currentPage: number,
  maxPage?: number,
): boolean {
  if (faces.length < 2) return false;
  if (isClosed(currentPage)) {
    // Opening the cover is always allowed when there is an interior.
    return faces.length > 1;
  }
  const next = nextPageIndex(currentPage);
  if (maxPage !== undefined && next > maxPage) return false;
  return currentPage + 2 < faces.length;
}

export function canGoBackward(currentPage: number): boolean {
  return currentPage > 0;
}

/** After a completed forward turn from `currentPage`. */
export function nextPageIndex(currentPage: number): number {
  if (isClosed(currentPage)) return 1;
  return currentPage + 2;
}

/** After a completed backward turn from `currentPage`. */
export function previousPageIndex(currentPage: number): number {
  if (currentPage <= 1) return 0;
  return currentPage - 2;
}

/**
 * Deterministic stacking.
 * Right-side unread pages stack downward; left-side read pages stack upward.
 */
export function getPageZIndex(
  faceIndex: number,
  currentPage: number,
  options: { turning?: boolean; turningIndex?: number } = {},
): number {
  const { turning = false, turningIndex } = options;
  if (turning && turningIndex === faceIndex) return 500;

  if (isClosed(currentPage)) {
    // Cover on top; anything else tucked under.
    return faceIndex === 0 ? 40 : 10 - Math.min(faceIndex, 9);
  }

  const left = currentPage;
  const right = currentPage + 1;

  if (faceIndex === left) return 30;
  if (faceIndex === right) return 30;

  // Already on the left stack (read)
  if (faceIndex < left) {
    return 20 - (left - faceIndex);
  }
  // Still on the right stack (unread)
  return 20 - (faceIndex - right);
}

export function cornerRestPoint(corner: Corner, w: number, h: number): Point {
  switch (corner) {
    case "top-left":
      return { x: 0, y: 0 };
    case "top-right":
      return { x: w, y: 0 };
    case "bottom-left":
      return { x: 0, y: h };
    case "bottom-right":
      return { x: w, y: h };
  }
}

export function isRightCorner(corner: Corner): boolean {
  return corner === "top-right" || corner === "bottom-right";
}

export function defaultCornerForDirection(direction: TurnDirection): Corner {
  return direction === "forward" ? "bottom-right" : "bottom-left";
}

export function hitTestCorner(
  x: number,
  y: number,
  w: number,
  h: number,
  zone = CORNER_ZONE,
): Corner | null {
  if (x >= w - zone && y <= zone) return "top-right";
  if (x >= w - zone && y >= h - zone) return "bottom-right";
  if (x <= zone && y <= zone) return "top-left";
  if (x <= zone && y >= h - zone) return "bottom-left";
  return null;
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

/** Cubic Bézier for programmatic corner path. */
export function cubicBezier(
  t: number,
  p0: Point,
  p1: Point,
  p2: Point,
  p3: Point,
): Point {
  const u = 1 - t;
  const tt = t * t;
  const uu = u * u;
  const uuu = uu * u;
  const ttt = tt * t;
  return {
    x: uuu * p0.x + 3 * uu * t * p1.x + 3 * u * tt * p2.x + ttt * p3.x,
    y: uuu * p0.y + 3 * uu * t * p1.y + 3 * u * tt * p2.y + ttt * p3.y,
  };
}

export function programmaticCornerPath(
  direction: TurnDirection,
  corner: Corner,
  w: number,
  h: number,
): { p0: Point; p1: Point; p2: Point; p3: Point } {
  const p0 = cornerRestPoint(corner, w, h);
  const forward = direction === "forward";
  const p3: Point = forward
    ? { x: 0, y: corner.startsWith("top") ? 0 : h }
    : { x: w, y: corner.startsWith("top") ? 0 : h };
  const midY = corner.startsWith("top") ? h * 0.15 : h * 0.85;
  const p1: Point = forward
    ? { x: w * 0.55, y: midY }
    : { x: w * 0.45, y: midY };
  const p2: Point = forward
    ? { x: w * 0.2, y: midY }
    : { x: w * 0.8, y: midY };
  return { p0, p1, p2, p3 };
}

/**
 * Progress 0→1 from a dragged tip. Forward (right page): drag toward spine.
 * Backward (left page): drag toward the outer edge.
 */
export function progressFromPointer(
  corner: Corner,
  pointer: Point,
  pageWidth: number,
): number {
  const origin = cornerRestPoint(corner, pageWidth, PAGE_HEIGHT);
  if (isRightCorner(corner)) {
    return clamp((origin.x - pointer.x) / pageWidth, 0, 1);
  }
  return clamp((pointer.x - origin.x) / pageWidth, 0, 1);
}

/** Synthetic pointer along the horizontal turn path for programmatic flips. */
export function pointerForProgress(
  corner: Corner,
  progress: number,
  pageWidth: number,
  pageHeight: number,
): Point {
  const origin = cornerRestPoint(corner, pageWidth, pageHeight);
  const t = clamp(progress, 0, 1);
  if (isRightCorner(corner)) {
    return { x: origin.x - t * pageWidth, y: origin.y };
  }
  return { x: origin.x + t * pageWidth, y: origin.y };
}

/**
 * Turn.js-style soft flip: the whole leaf hinges at the spine with rotateY
 * (0 → ±180). Drag progress maps to the angle; shadows sell the curl.
 */
export function calculateFold({
  pageWidth: w,
  pageHeight: h,
  corner,
  pointer,
  direction,
}: {
  pageWidth: number;
  pageHeight: number;
  corner: Corner;
  pointer: Point;
  direction: TurnDirection;
}): FoldGeometry {
  void h;
  const right = isRightCorner(corner);
  const progress = progressFromPointer(corner, pointer, w);
  const flipDeg = right ? -progress * 180 : progress * 180;
  const transformOrigin = right ? "left center" : "right center";

  const shade = Math.sin(progress * Math.PI);
  const band = clamp(progress * 100, 0, 100);
  const frontShadow = right
    ? `linear-gradient(90deg,
        rgba(37,42,58,${0.18 * shade}) 0%,
        rgba(37,42,58,${0.05 * shade}) 18%,
        transparent 42%,
        rgba(255,255,255,${0.12 * shade}) 78%,
        rgba(37,42,58,${0.08 * shade}) 100%)`
    : `linear-gradient(270deg,
        rgba(37,42,58,${0.18 * shade}) 0%,
        rgba(37,42,58,${0.05 * shade}) 18%,
        transparent 42%,
        rgba(255,255,255,${0.12 * shade}) 78%,
        rgba(37,42,58,${0.08 * shade}) 100%)`;
  const backShadow = `rgba(37, 42, 58, ${0.12 + 0.28 * shade})`;
  const underShadow = right
    ? `linear-gradient(270deg, rgba(37,42,58,${0.32 * shade}) 0%, rgba(37,42,58,${0.1 * shade}) 40%, transparent 75%)`
    : `linear-gradient(90deg, rgba(37,42,58,${0.32 * shade}) 0%, rgba(37,42,58,${0.1 * shade}) 40%, transparent 75%)`;
  const highlight = right
    ? `linear-gradient(270deg,
        transparent ${Math.max(0, band - 22)}%,
        rgba(255,255,255,${0.38 * shade}) ${band}%,
        transparent ${Math.min(100, band + 16)}%)`
    : `linear-gradient(90deg,
        transparent ${Math.max(0, band - 22)}%,
        rgba(255,255,255,${0.38 * shade}) ${band}%,
        transparent ${Math.min(100, band + 16)}%)`;
  const drift = 10 + progress * 28;
  const contactShadow = right
    ? `${-drift}px 18px 32px rgba(20, 16, 10, ${0.16 + 0.22 * shade})`
    : `${drift}px 18px 32px rgba(20, 16, 10, ${0.16 + 0.22 * shade})`;

  return {
    progress,
    flipDeg,
    transformOrigin,
    frontShadow,
    backShadow,
    underShadow,
    highlight,
    contactShadow,
    clipPath: "none",
    corner,
    direction,
  };
}

export function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/** Arrow keys must not steal focus from chapter title / story fields. */
export function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  return Boolean(
    target.closest("input, textarea, select, [contenteditable='true']"),
  );
}
