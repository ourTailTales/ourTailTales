import { PDFDocument, StandardFonts, degrees, rgb, type PDFFont, type PDFPage } from "pdf-lib";

import { BLEED_INCHES, TRIM_INCHES } from "@/lib/book/layouts";
import { CLOSING_LINE } from "@/lib/book/pagination";
import {
  DEFAULT_COVER_FONT,
  DEFAULT_COVER_LAYOUT,
  defaultDatesPos,
  defaultNamePos,
} from "@/lib/book/coverLayouts";
import { brand, hexToRgb01 } from "@/lib/brand";
import * as assetStore from "@/lib/photo/assetStore";
import { rasterizeForPlacement } from "@/lib/photo/pipeline";
import type { BookMeta, CoverFontId, CoverLayoutId } from "@/types/book";

const PT_PER_INCH = 72;
const TRIM_PT = TRIM_INCHES * PT_PER_INCH;
const BLEED_PT = BLEED_INCHES * PT_PER_INCH;

function brandRgb(hex: string) {
  const { r, g, b } = hexToRgb01(hex);
  return rgb(r, g, b);
}

const PAPER = brandRgb(brand.colors.white);
const INK = brandRgb(brand.colors.ink);
const PAPER_SOFT = brandRgb(brand.colors.memoryBlue);
const SCRIM = brandRgb(brand.colors.ink);
const SCRIM_MAX_OPACITY = 0.72;
const PERIWINKLE = brandRgb(brand.colors.periwinkle);
const PERIWINKLE_DEEP = brandRgb(brand.colors.periwinkleDeep);

/** Below this a spine is too narrow to carry legible type. */
const MIN_SPINE_TEXT_PT = 22;

export type CoverDimensionsPt = { width: number; height: number };

type Rect = { x: number; y: number; width: number; height: number };

type CoverFontSet = {
  serif: PDFFont;
  serifBold: PDFFont;
  serifItalic: PDFFont;
  sans: PDFFont;
  sansBold: PDFFont;
};

/**
 * Renders the full wrap cover at exactly the size Lulu reported.
 *
 * The spine width is never guessed — it comes from `POST /cover-dimensions/`
 * for this pod package and this interior page count.
 *
 * Known gap: the name/years font choice made in the cover editor is only
 * approximated here (mapped to the closest built-in PDF font — pdf-lib has
 * no access to Merienda/Cormorant/Playfair/Caveat unless those font files
 * are embedded directly, which this doesn't do yet). Layout and text
 * position, however, match the editor exactly.
 */
export async function renderCoverPdf(args: {
  meta: BookMeta;
  dimensions: CoverDimensionsPt;
  targetPpi?: number;
}): Promise<Blob> {
  const { meta, dimensions, targetPpi = 300 } = args;

  const pdf = await PDFDocument.create();
  pdf.setTitle(meta.petName ? `${meta.petName} — cover` : "ourTailTales cover");
  pdf.setProducer("ourTailTales");

  const fonts: CoverFontSet = {
    serif: await pdf.embedFont(StandardFonts.TimesRoman),
    serifBold: await pdf.embedFont(StandardFonts.TimesRomanBold),
    serifItalic: await pdf.embedFont(StandardFonts.TimesRomanItalic),
    sans: await pdf.embedFont(StandardFonts.Helvetica),
    sansBold: await pdf.embedFont(StandardFonts.HelveticaBold),
  };

  const page = pdf.addPage([dimensions.width, dimensions.height]);
  page.drawRectangle({
    x: 0,
    y: 0,
    width: dimensions.width,
    height: dimensions.height,
    color: PAPER,
  });

  const spineWidth = Math.max(
    0,
    dimensions.width - BLEED_PT * 2 - TRIM_PT * 2,
  );
  const frontLeft = dimensions.width - BLEED_PT - TRIM_PT;

  // The front cover art bleeds off the top, right, and bottom edges.
  const artLeft = frontLeft;
  const artWidth = dimensions.width - artLeft;
  const artHeight = dimensions.height;

  const coverFile = meta.coverPhotoId
    ? assetStore.getFile(meta.coverPhotoId)
    : undefined;

  const layoutId: CoverLayoutId = meta.coverLayoutId ?? DEFAULT_COVER_LAYOUT;
  const fontId: CoverFontId = meta.coverFontId ?? DEFAULT_COVER_FONT;

  await drawCoverLayout(pdf, page, {
    layoutId,
    artLeft,
    artWidth,
    artHeight,
    coverFile,
    targetPpi,
  });

  const nameBold = meta.coverNameBold ?? true;
  const { name: nameFont, years: yearsFont } = pdfFontsForCoverFont(
    fontId,
    fonts,
    nameBold,
  );

  const petName = meta.petName || "Their name";
  const years = lifespanText(meta);
  const namePos = meta.coverNamePos ?? defaultNamePos(layoutId);
  const datesPos = meta.coverDatesPos ?? defaultDatesPos(layoutId);
  const nameSize = meta.coverNameSize ? meta.coverNameSize * 15 : 30;

  drawCenteredText(page, petName, nameFont, nameSize, PAPER, {
    x: artLeft + (namePos.x / 100) * artWidth,
    y: artHeight - (namePos.y / 100) * artHeight,
  });

  if (years) {
    drawCenteredText(page, years, yearsFont, 10, PAPER, {
      x: artLeft + (datesPos.x / 100) * artWidth,
      y: artHeight - (datesPos.y / 100) * artHeight,
      opacity: 0.85,
    });
  }

  /* --------------------------------- spine --------------------------------- */

  if (spineWidth >= MIN_SPINE_TEXT_PT) {
    const spineCenter = BLEED_PT + TRIM_PT + spineWidth / 2;
    const spineText = years ? `${petName}   ${years}` : petName;
    const spineSize = Math.min(13, spineWidth * 0.42);
    const textWidth = fonts.serif.widthOfTextAtSize(spineText, spineSize);

    page.drawText(spineText, {
      x: spineCenter + spineSize * 0.36,
      y: (dimensions.height - textWidth) / 2,
      font: fonts.serif,
      size: spineSize,
      color: INK,
      rotate: degrees(90),
    });
  }

  /* ---------------------------------- back --------------------------------- */

  const backLeft = BLEED_PT + 0.75 * PT_PER_INCH;
  const backWidth = TRIM_PT - 1.5 * PT_PER_INCH;
  const backText = meta.dedication.trim() || CLOSING_LINE;
  const lines = wrap(backText, fonts.serif, 13, backWidth).slice(0, 8);

  let baseline = dimensions.height * 0.62;
  for (const line of lines) {
    page.drawText(line, {
      x: backLeft,
      y: baseline,
      font: fonts.serif,
      size: 13,
      color: INK,
    });
    baseline -= 20;
  }

  page.drawText("ourTailTales", {
    x: backLeft,
    y: BLEED_PT + 0.75 * PT_PER_INCH,
    font: fonts.sans,
    size: 9,
    color: INK,
    opacity: 0.7,
  });

  const bytes = await pdf.save();
  return new Blob([bytes as unknown as BlobPart], { type: "application/pdf" });
}

/**
 * Draws the front-cover background for the chosen layout: photo placement,
 * any color band/margin/scrim, and the "OURTAILTALES" wordmark. Mirrors
 * `CoverLayoutChrome` (the on-screen version) so the print file matches what
 * the customer designed.
 */
async function drawCoverLayout(
  pdf: PDFDocument,
  page: PDFPage,
  args: {
    layoutId: CoverLayoutId;
    artLeft: number;
    artWidth: number;
    artHeight: number;
    coverFile: File | undefined;
    targetPpi: number;
  },
): Promise<void> {
  const { layoutId, artLeft, artWidth, artHeight, coverFile, targetPpi } = args;
  const sans = await pdf.embedFont(StandardFonts.Helvetica);
  const wordmarkSize = 7;

  switch (layoutId) {
    case "framed": {
      const insetX = artWidth * 0.07;
      const insetY = artHeight * 0.07;
      const rect: Rect = {
        x: artLeft + insetX,
        y: insetY,
        width: artWidth - insetX * 2,
        height: artHeight - insetY * 2,
      };
      await drawPhotoOrFallback(pdf, page, coverFile, targetPpi, rect);
      drawScrim(page, rect.x, rect.width, rect.height * 0.3, rect.y);
      page.drawText("OURTAILTALES", {
        x: artLeft + artWidth / 2 - sans.widthOfTextAtSize("OURTAILTALES", wordmarkSize) / 2,
        y: artHeight - insetY * 0.6,
        font: sans,
        size: wordmarkSize,
        color: INK,
        opacity: 0.8,
      });
      return;
    }

    case "banner": {
      const bandHeight = artHeight * 0.22;
      const photoRect: Rect = {
        x: artLeft,
        y: bandHeight,
        width: artWidth,
        height: artHeight - bandHeight,
      };
      await drawPhotoOrFallback(pdf, page, coverFile, targetPpi, photoRect);
      page.drawRectangle({
        x: artLeft,
        y: 0,
        width: artWidth,
        height: bandHeight,
        color: PERIWINKLE_DEEP,
      });
      page.drawText("OURTAILTALES", {
        x: artLeft + BLEED_PT + 0.4 * PT_PER_INCH,
        y: bandHeight / 2 - wordmarkSize / 2,
        font: sans,
        size: wordmarkSize,
        color: PAPER,
        opacity: 0.9,
      });
      return;
    }

    case "minimal": {
      const rect: Rect = { x: artLeft, y: 0, width: artWidth, height: artHeight };
      await drawPhotoOrFallback(pdf, page, coverFile, targetPpi, rect);
      page.drawRectangle({ ...rect, color: SCRIM, opacity: 0.4 });
      page.drawText("OURTAILTALES", {
        x: artLeft + artWidth / 2 - sans.widthOfTextAtSize("OURTAILTALES", wordmarkSize) / 2,
        y: artHeight - BLEED_PT - 0.5 * PT_PER_INCH,
        font: sans,
        size: wordmarkSize,
        color: PAPER,
        opacity: 0.9,
      });
      return;
    }

    case "sidebar": {
      const barWidth = artWidth * 0.18;
      page.drawRectangle({
        x: artLeft,
        y: 0,
        width: barWidth,
        height: artHeight,
        color: PERIWINKLE,
      });
      const photoRect: Rect = {
        x: artLeft + barWidth,
        y: 0,
        width: artWidth - barWidth,
        height: artHeight,
      };
      await drawPhotoOrFallback(pdf, page, coverFile, targetPpi, photoRect);
      page.drawText("OURTAILTALES", {
        x: artLeft + barWidth * 0.18,
        y: artHeight - BLEED_PT - 0.6 * PT_PER_INCH,
        font: sans,
        size: wordmarkSize,
        color: PAPER,
        opacity: 0.9,
      });
      return;
    }

    case "classic":
    default: {
      const rect: Rect = { x: artLeft, y: 0, width: artWidth, height: artHeight };
      await drawPhotoOrFallback(pdf, page, coverFile, targetPpi, rect);
      drawScrim(page, artLeft, artWidth, artHeight * 0.36, 0);
      page.drawText("OURTAILTALES", {
        x: artLeft + BLEED_PT + 0.5 * PT_PER_INCH,
        y: artHeight - BLEED_PT - 0.75 * PT_PER_INCH,
        font: sans,
        size: wordmarkSize + 2,
        color: PAPER,
        opacity: 0.9,
      });
      return;
    }
  }
}

async function drawPhotoOrFallback(
  pdf: PDFDocument,
  page: PDFPage,
  coverFile: File | undefined,
  targetPpi: number,
  rect: Rect,
): Promise<void> {
  if (coverFile) {
    try {
      const placement = await rasterizeForPlacement(
        coverFile,
        rect.width / PT_PER_INCH,
        rect.height / PT_PER_INCH,
        targetPpi,
        0.9,
      );
      const embedded = await pdf.embedJpg(
        new Uint8Array(await placement.blob.arrayBuffer()),
      );
      page.drawImage(embedded, rect);
      return;
    } catch {
      // fall through to the flat placeholder below
    }
  }
  page.drawRectangle({ ...rect, color: PAPER_SOFT });
}

/**
 * PDF has no portable gradient primitive, so the scrim is stacked bands whose
 * opacity eases in. A single flat rectangle leaves a hard line printed across
 * the front cover. `baseY` lets the band sit above an inset photo's bottom
 * edge instead of always the page bottom.
 */
function drawScrim(
  page: PDFPage,
  x: number,
  width: number,
  height: number,
  baseY: number,
): void {
  const bands = 28;
  const bandHeight = height / bands;

  for (let index = 0; index < bands; index += 1) {
    // Bottom band is darkest; the top fades to nothing.
    const t = 1 - index / bands;
    page.drawRectangle({
      x,
      y: baseY + index * bandHeight,
      width,
      // Overlap by a hair so band seams never show as light lines.
      height: bandHeight + 0.5,
      color: SCRIM,
      opacity: SCRIM_MAX_OPACITY * t * t,
    });
  }
}

function drawCenteredText(
  page: PDFPage,
  text: string,
  font: PDFFont,
  size: number,
  color: ReturnType<typeof rgb>,
  center: { x: number; y: number; opacity?: number },
): void {
  const textWidth = font.widthOfTextAtSize(text, size);
  page.drawText(text, {
    x: center.x - textWidth / 2,
    // Baseline sits a bit below the visual center of the glyphs.
    y: center.y - size * 0.35,
    font,
    size,
    color,
    opacity: center.opacity ?? 1,
  });
}

/** Approximates the editor's 5 cover fonts with the closest built-in PDF font. */
function pdfFontsForCoverFont(
  fontId: CoverFontId,
  fonts: CoverFontSet,
  nameBold = true,
): { name: PDFFont; years: PDFFont } {
  switch (fontId) {
    case "sans":
      return { name: nameBold ? fonts.sansBold : fonts.sans, years: fonts.sans };
    case "display":
    case "caveat":
      return { name: fonts.serifItalic, years: fonts.serifItalic };
    case "playfair":
    case "cover":
    default:
      return { name: nameBold ? fonts.serifBold : fonts.serif, years: fonts.serif };
  }
}

function wrap(
  text: string,
  font: PDFFont,
  size: number,
  maxWidth: number,
): string[] {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return [];

  const lines: string[] = [];
  let current = "";
  for (const word of clean.split(" ")) {
    const candidate = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
      current = candidate;
    } else {
      if (current) lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function lifespanText(meta: BookMeta): string {
  if (meta.birthYear && meta.deathYear) {
    return `${meta.birthYear} – ${meta.deathYear}`;
  }
  return meta.birthYear || meta.deathYear || "";
}
