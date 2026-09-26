import { BLEED_INCHES, TRIM_INCHES } from "@/lib/book/layouts";

/**
 * Shared measurements for the hardcover casewrap cover, used by the print PDF
 * (`cover-pdf.ts`, server and checkout). Keeping these in one place avoids
 * them drifting apart (see `cover-pdf.ts`'s history: the print renderer once
 * computed the wrap without this term and shipped covers whose art stopped
 * short of the true edge).
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
