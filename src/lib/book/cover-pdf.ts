import { PDFDocument, degrees, rgb, type PDFPage } from "pdf-lib";

import { embedBookFonts, sanitizeForFont } from "@/lib/book/fonts";
import { BLEED_INCHES, TRIM_INCHES } from "@/lib/book/layouts";
import { CLOSING_LINE } from "@/lib/book/pagination";
import { brand, hexToRgb01 } from "@/lib/brand";
import * as assetStore from "@/lib/photo/assetStore";
import { rasterizeForPlacement } from "@/lib/photo/pipeline";
import type { BookMeta } from "@/types/book";

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

/** Below this a spine is too narrow to carry legible type. */
const MIN_SPINE_TEXT_PT = 22;

export type CoverDimensionsPt = { width: number; height: number };

/**
 * Renders the full wrap cover at exactly the size Lulu reported.
 *
 * The spine width is never guessed — it comes from `POST /cover-dimensions/`
 * for this pod package and this interior page count.
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

  const { display, sans } = await embedBookFonts(pdf);

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

  // The front cover photo bleeds off the top, right, and bottom edges.
  const artLeft = frontLeft;
  const artWidth = dimensions.width - artLeft;
  const artHeight = dimensions.height;

  const coverFile = meta.coverPhotoId
    ? assetStore.getFile(meta.coverPhotoId)
    : undefined;

  if (coverFile) {
    try {
      const placement = await rasterizeForPlacement(
        coverFile,
        artWidth / PT_PER_INCH,
        artHeight / PT_PER_INCH,
        targetPpi,
        0.9,
      );
      const embedded = await pdf.embedJpg(
        new Uint8Array(await placement.blob.arrayBuffer()),
      );
      page.drawImage(embedded, {
        x: artLeft,
        y: 0,
        width: artWidth,
        height: artHeight,
      });
    } catch {
      page.drawRectangle({
        x: artLeft,
        y: 0,
        width: artWidth,
        height: artHeight,
        color: PAPER_SOFT,
      });
    }
  } else {
    page.drawRectangle({
      x: artLeft,
      y: 0,
      width: artWidth,
      height: artHeight,
      color: PAPER_SOFT,
    });
  }

  // Scrim so the title stays legible over any photograph.
  drawScrim(page, artLeft, artWidth, artHeight * 0.36);

  const titleSize = 42;
  const petName = sanitizeForFont(display, meta.petName || "Their name");
  const safeLeft = artLeft + BLEED_PT + 0.5 * PT_PER_INCH;
  const titleBaseline = artHeight * 0.16;

  page.drawText(petName, {
    x: safeLeft,
    y: titleBaseline,
    font: display,
    size: titleSize,
    color: PAPER,
  });

  const years = lifespanText(meta);
  if (years) {
    page.drawText(years, {
      x: safeLeft,
      y: titleBaseline - 24,
      font: sans,
      size: 11,
      color: PAPER,
      opacity: 0.85,
    });
  }

  page.drawText("OURTAILTALES", {
    x: safeLeft,
    y: artHeight - BLEED_PT - 0.75 * PT_PER_INCH,
    font: sans,
    size: 9,
    color: PAPER,
    opacity: 0.9,
  });

  /* --------------------------------- spine --------------------------------- */

  if (spineWidth >= MIN_SPINE_TEXT_PT) {
    const spineCenter = BLEED_PT + TRIM_PT + spineWidth / 2;
    const spineText = years ? `${petName}   ${years}` : petName;
    const spineSize = Math.min(13, spineWidth * 0.42);
    const textWidth = display.widthOfTextAtSize(spineText, spineSize);

    page.drawText(spineText, {
      x: spineCenter + spineSize * 0.36,
      y: (dimensions.height - textWidth) / 2,
      font: display,
      size: spineSize,
      color: INK,
      rotate: degrees(90),
    });
  }

  /* ---------------------------------- back --------------------------------- */

  const backLeft = BLEED_PT + 0.75 * PT_PER_INCH;
  const backWidth = TRIM_PT - 1.5 * PT_PER_INCH;
  const backText = sanitizeForFont(display, meta.dedication.trim() || CLOSING_LINE);
  const lines = wrap(backText, display, 13, backWidth).slice(0, 8);

  let baseline = dimensions.height * 0.62;
  for (const line of lines) {
    page.drawText(line, {
      x: backLeft,
      y: baseline,
      font: display,
      size: 13,
      color: INK,
    });
    baseline -= 20;
  }

  page.drawText("ourTailTales", {
    x: backLeft,
    y: BLEED_PT + 0.75 * PT_PER_INCH,
    font: sans,
    size: 9,
    color: INK,
    opacity: 0.7,
  });

  const bytes = await pdf.save();
  return new Blob([bytes as unknown as BlobPart], { type: "application/pdf" });
}

/**
 * PDF has no portable gradient primitive, so the scrim is stacked bands whose
 * opacity eases in. A single flat rectangle leaves a hard line printed across
 * the front cover.
 */
function drawScrim(
  page: PDFPage,
  x: number,
  width: number,
  height: number,
): void {
  const bands = 28;
  const bandHeight = height / bands;

  for (let index = 0; index < bands; index += 1) {
    // Bottom band is darkest; the top fades to nothing.
    const t = 1 - index / bands;
    page.drawRectangle({
      x,
      y: index * bandHeight,
      width,
      // Overlap by a hair so band seams never show as light lines.
      height: bandHeight + 0.5,
      color: SCRIM,
      opacity: SCRIM_MAX_OPACITY * t * t,
    });
  }
}

function wrap(
  text: string,
  font: Awaited<ReturnType<PDFDocument["embedFont"]>>,
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
