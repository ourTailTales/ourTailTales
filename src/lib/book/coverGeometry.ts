import { BLEED_INCHES, TRIM_INCHES } from "@/lib/book/layouts";

/**
 * Shared front/spine/back panel geometry for the hardcover casewrap cover —
 * the single source of truth for both the print PDF (`cover-pdf.ts`, server
 * and checkout) and any client-side preview that needs to crop a customer's
 * uploaded cover file into its front/back panels. Keeping this in one place
 * avoids the two drifting apart (see `cover-pdf.ts`'s history: the print
 * renderer once computed this without the wrap term and shipped covers
 * whose art stopped short of the true edge).
 */

export const PT_PER_INCH = 72;
export const TRIM_PT = TRIM_INCHES * PT_PER_INCH;
export const BLEED_PT = BLEED_INCHES * PT_PER_INCH;

/**
 * Hardcover casewrap's board-wrap allowance — separate from print bleed.
 * Lulu wraps the cover sheet 0.75" around each board edge (top, bottom, and
 * the two outer edges of the front/back panels) for every casewrap SKU,
 * regardless of page count; only the spine varies with page count, and Lulu
 * folds that variation into the total width/height `fetchCoverDimensions`
 * already returns. This constant is what lets us split that already-correct
 * total back into front/spine/back panel positions locally.
 */
export const HARDCOVER_WRAP_INCHES = 0.75;
export const WRAP_PT = HARDCOVER_WRAP_INCHES * PT_PER_INCH;

export type CoverDimensionsPt = { width: number; height: number };

/** A panel's region within the full wrap-cover canvas, in PDF points from the bottom-left (PDF/pdf-lib convention: y grows upward). */
export type CoverPanelRectPt = { x: number; y: number; width: number; height: number };

export type CoverPanelsPt = {
  /** Left wrap + back trim + back bleed — the region a back-cover crop should use. */
  back: CoverPanelRectPt;
  spine: CoverPanelRectPt;
  /** Front trim + front bleed + right wrap — the region a front-cover crop should use. */
  front: CoverPanelRectPt;
};

/**
 * Splits the full wrap-cover canvas (as Lulu reports it) into back / spine /
 * front panel rectangles, in PDF points. The back and front rectangles each
 * include their adjoining wrap strip, matching what `renderCoverPdf` bleeds
 * the front-cover art into — so a crop of either matches what actually
 * prints on that panel.
 */
export function coverPanelsPt(dimensions: CoverDimensionsPt): CoverPanelsPt {
  const spineWidth = Math.max(
    0,
    dimensions.width - WRAP_PT * 2 - BLEED_PT * 2 - TRIM_PT * 2,
  );
  const backWidth = WRAP_PT + TRIM_PT + BLEED_PT;
  const frontWidth = TRIM_PT + BLEED_PT + WRAP_PT;
  const frontLeft = dimensions.width - frontWidth;

  return {
    back: { x: 0, y: 0, width: backWidth, height: dimensions.height },
    spine: { x: backWidth, y: 0, width: spineWidth, height: dimensions.height },
    front: { x: frontLeft, y: 0, width: frontWidth, height: dimensions.height },
  };
}
