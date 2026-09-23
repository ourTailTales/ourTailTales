import {
  PDFDocument,
  StandardFonts,
  degrees,
  rgb,
  type PDFFont,
  type PDFPage,
} from "pdf-lib";

import { brand, hexToRgb01 } from "@/lib/brand";

/**
 * Server-side watermarking for the free preview PDF.
 *
 * `interior-pdf.ts` can already stamp a watermark while it renders, but that
 * happens in the browser, where the flag is just as easy to omit as to pass.
 * This module re-stamps whatever bytes actually arrive, so the copy served to
 * a free reader is watermarked because the server made it so — not because a
 * client was well behaved.
 */

export const WATERMARK_TEXT = `PREVIEW — ${brand.domain}`;

const FONT_SIZE = 36;
const OPACITY = 0.15;
const ANGLE = 45;

function periwinkle() {
  const { r, g, b } = hexToRgb01(brand.colors.periwinkle);
  return rgb(r, g, b);
}

/**
 * Returns a new PDF with the preview watermark across every page.
 *
 * The source bytes are never mutated; Phase 3 keeps the clean original next to
 * this one and swaps which is served after purchase.
 */
export async function watermarkPdf(
  pdfBytes: Uint8Array,
  text: string = WATERMARK_TEXT,
): Promise<Uint8Array> {
  const document = await PDFDocument.load(pdfBytes);
  const font = await document.embedFont(StandardFonts.HelveticaBold);

  for (const page of document.getPages()) {
    drawDiagonalWatermark(page, font, text);
  }

  return document.save();
}

/**
 * One diagonal line across the page, anchored on the centre.
 *
 * The text is measured rather than positioned by guesswork so the mark stays
 * centred on any trim size — the interior runs 8.75in square, the cover does
 * not, and a hardcoded offset would drift off the edge of one of them.
 */
function drawDiagonalWatermark(
  page: PDFPage,
  font: PDFFont,
  text: string,
): void {
  const { width, height } = page.getSize();
  const radians = (ANGLE * Math.PI) / 180;
  const textWidth = font.widthOfTextAtSize(text, FONT_SIZE);
  const textHeight = font.heightAtSize(FONT_SIZE);

  // Walk back from the page centre along the baseline direction by half the
  // string, then drop by half its height, so the glyph run is centred on the
  // page rather than starting there.
  const x = width / 2 - (textWidth / 2) * Math.cos(radians) + (textHeight / 2) * Math.sin(radians);
  const y = height / 2 - (textWidth / 2) * Math.sin(radians) - (textHeight / 2) * Math.cos(radians);

  page.drawText(text, {
    x,
    y,
    font,
    size: FONT_SIZE,
    color: periwinkle(),
    opacity: OPACITY,
    rotate: degrees(ANGLE),
  });
}
