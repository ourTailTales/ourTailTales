import type { CSSProperties } from "react";

/**
 * Shared physical-book geometry for InteractiveBookHero.
 * All cover / page / stack layers must derive from these tokens.
 */

export const BOOK_GEOMETRY = {
  /** Open stage aspect: width / height (two pages side by side). */
  openAspect: 1.38,

  /** Hardcover beyond the paper on each outer edge. */
  coverOverhangPx: 5,
  /** Visible page-stack fore-edge beyond the right page. */
  pageStackOverhangPx: 12,
  /** Extra back-board beyond the page stack. */
  boardOverhangPx: 3,

  spineWidthPx: 14,
  coverRadiusPx: 14,
  pageRadiusPx: 10,
  /** 3D board thickness cue on the fore-edge. */
  boardThicknessPx: 36,
  topLipPx: 6,

  pageStackLayers: 12,
} as const;

/** CSS custom properties applied on the book scene root. */
export function bookGeometryStyle(): CSSProperties {
  const g = BOOK_GEOMETRY;
  return {
    ["--book-cover-overhang" as string]: `${g.coverOverhangPx}px`,
    ["--book-stack-overhang" as string]: `${g.pageStackOverhangPx}px`,
    ["--book-board-overhang" as string]: `${g.boardOverhangPx}px`,
    ["--book-spine" as string]: `${g.spineWidthPx}px`,
    ["--book-cover-radius" as string]: `${g.coverRadiusPx}px`,
    ["--book-page-radius" as string]: `${g.pageRadiusPx}px`,
    ["--book-board-thickness" as string]: `${g.boardThicknessPx}px`,
    ["--book-top-lip" as string]: `${g.topLipPx}px`,
  };
}
