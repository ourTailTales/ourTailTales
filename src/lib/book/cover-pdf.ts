import { PDFDocument, StandardFonts, degrees, rgb, type PDFFont, type PDFPage } from "pdf-lib";

import {
  BLEED_PT,
  PT_PER_INCH,
  TRIM_PT,
  WRAP_PT,
  type CoverDimensionsPt,
} from "@/lib/book/coverGeometry";
import { CLOSING_LINE } from "@/lib/book/pagination";
import {
  DEFAULT_COVER_FONT,
  DEFAULT_COVER_LAYOUT,
  CLASSIC_SCRIM_HEIGHT,
  CLASSIC_SCRIM_STOPS,
  DEFAULT_COVER_NAME_SIZE,
  KEEPSAKE_PAW,
  KEEPSAKE_RULES,
  MONOGRAM_LETTER,
  PLATE_RULE_HALF_WIDTH,
  PLATE_RULE_Y,
  PLATE_YEARS_Y,
  PORTRAIT_MAT,
  PORTRAIT_WINDOW,
  coverTextTone,
  defaultNameAnchor,
} from "@/lib/book/coverLayouts";
import { DOODLE_PATHS, DOODLE_STROKE, lifespanText } from "@/lib/book/design/primitives";
import { verticalAlphaRampPng } from "@/lib/book/gradient-png";
import { resolvePalette, type BookPalette } from "@/lib/book/palette";
import { coverNameFont, drawable, loadBookFonts, type BookFonts } from "@/lib/book/pdf-fonts";
import { brand, hexToRgb01 } from "@/lib/brand";
import { expiryHeadline, formatExpiryDate } from "@/lib/drafts/expiry";
import * as assetStore from "@/lib/photo/assetStore";
import { rasterizeForPlacement } from "@/lib/photo/pipeline";
import type { BookMeta, CoverFontId, CoverLayoutId } from "@/types/book";

function brandRgb(hex: string) {
  const { r, g, b } = hexToRgb01(hex);
  return rgb(r, g, b);
}

const PAPER = brandRgb(brand.colors.white);
const INK = brandRgb(brand.colors.ink);
const PAPER_SOFT = brandRgb(brand.colors.memoryBlue);
const SCRIM = brandRgb(brand.colors.ink);

/** Below this a spine is too narrow to carry legible type. */
const MIN_SPINE_TEXT_PT = 22;

export type { CoverDimensionsPt } from "@/lib/book/coverGeometry";

type Rect = { x: number; y: number; width: number; height: number };

/**
 * Renders the full wrap cover at exactly the size Lulu reported.
 *
 * The spine width is never guessed — it comes from `POST /cover-dimensions/`
 * for this pod package and this interior page count. The name is set in the
 * face chosen in the cover editor, embedded from `public/fonts`.
 */
export async function renderCoverPdf(args: {
  meta: BookMeta;
  dimensions: CoverDimensionsPt;
  targetPpi?: number;
}): Promise<Blob> {
  const { meta, dimensions, targetPpi = 300 } = args;

  const pdf = await PDFDocument.create();
  pdf.setTitle(meta.petName ? `${meta.petName}, cover` : "ourTailTales cover");
  pdf.setProducer("ourTailTales");

  const fonts = await loadBookFonts(pdf);
  // The back cover and spine are printed on the book's own paper and ink.
  const palette = resolvePalette(meta);
  const paper = brandRgb(palette.paper);
  const ink = brandRgb(palette.ink);

  const page = pdf.addPage([dimensions.width, dimensions.height]);
  page.drawRectangle({
    x: 0,
    y: 0,
    width: dimensions.width,
    height: dimensions.height,
    color: paper,
  });

  const spineWidth = Math.max(
    0,
    dimensions.width - WRAP_PT * 2 - BLEED_PT * 2 - TRIM_PT * 2,
  );
  const frontLeft = dimensions.width - WRAP_PT - BLEED_PT - TRIM_PT;

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
    meta,
    palette,
    fonts,
  });

  const nameBold = meta.coverNameBold ?? true;
  const nameFont = coverNameFont(fontId, fonts, nameBold);

  drawCoverName(page, {
    meta,
    layoutId,
    nameFont,
    artLeft,
    artWidth,
    artHeight,
  });

  /* --------------------------------- spine --------------------------------- */

  const spineText = drawable(fonts.serif, meta.petName.trim());
  if (spineWidth >= MIN_SPINE_TEXT_PT && spineText) {
    const spineCenter = BLEED_PT + TRIM_PT + spineWidth / 2;
    const spineSize = Math.min(13, spineWidth * 0.42);
    const textWidth = fonts.serif.widthOfTextAtSize(spineText, spineSize);

    page.drawText(spineText, {
      x: spineCenter + spineSize * 0.36,
      y: (dimensions.height - textWidth) / 2,
      font: fonts.serif,
      size: spineSize,
      color: ink,
      rotate: degrees(90),
    });
  }

  /* ---------------------------------- back ---------------------------------
   * Styled like a real memoir/photo-book back cover: a centered pull-quote
   * (the dedication, or a fallback line) sitting in the upper-middle third,
   * a small divider, and a publisher-style colophon anchored at the bottom —
   * mirrors `BackCoverArt` (the on-screen version). */

  const backCenterX = WRAP_PT + (TRIM_PT + BLEED_PT) / 2;
  const backWidth = TRIM_PT - 1.6 * PT_PER_INCH;
  const backText = meta.dedication.trim() || CLOSING_LINE;
  const quoteSize = 13;
  const quoteLines = wrap(`“${backText}”`, fonts.serifItalic, quoteSize, backWidth).slice(0, 8);
  const lineHeight = 20;

  let baseline = dimensions.height / 2 + (quoteLines.length * lineHeight) / 2 - lineHeight;
  for (const line of quoteLines) {
    drawCenteredText(page, line, fonts.serifItalic, quoteSize, ink, {
      x: backCenterX,
      y: baseline,
    });
    baseline -= lineHeight;
  }

  drawCenteredText(page, "•  •  •", fonts.sans, 9, ink, {
    x: backCenterX,
    y: baseline - 6,
    opacity: 0.4,
  });

  const colophonY = BLEED_PT + 0.9 * PT_PER_INCH;
  drawCenteredText(page, brand.name, fonts.sansBold, 9, ink, {
    x: backCenterX,
    y: colophonY + 12,
    opacity: 0.8,
  });
  drawCenteredText(page, brand.domain, fonts.sans, 7.5, ink, {
    x: backCenterX,
    y: colophonY,
    opacity: 0.5,
  });

  const bytes = await pdf.save();
  return new Blob([bytes as unknown as BlobPart], { type: "application/pdf" });
}

/**
 * Wraps a customer-supplied PNG/JPG into a single-page PDF at exactly the
 * dimensions Lulu requires for this book — used at checkout when the
 * customer uploaded their own front+spine+back artwork instead of using the
 * in-app cover design. The file has already been validated to match
 * `dimensions` (see `lib/book/customCover`); a PDF upload skips this
 * entirely and is sent to Lulu as-is.
 */
export async function wrapImageAsCoverPdf(args: {
  file: File;
  dimensions: CoverDimensionsPt;
}): Promise<Blob> {
  const { file, dimensions } = args;
  const pdf = await PDFDocument.create();
  pdf.setProducer("ourTailTales");

  const page = pdf.addPage([dimensions.width, dimensions.height]);
  const bytes = new Uint8Array(await file.arrayBuffer());
  const isPng = file.type === "image/png" || file.name.toLowerCase().endsWith(".png");
  const embedded = isPng ? await pdf.embedPng(bytes) : await pdf.embedJpg(bytes);
  page.drawImage(embedded, {
    x: 0,
    y: 0,
    width: dimensions.width,
    height: dimensions.height,
  });

  const out = await pdf.save();
  return new Blob([out as unknown as BlobPart], { type: "application/pdf" });
}

/**
 * Draws the pet's name where the cover editor put it, in the chosen font and
 * size, within the rectangle the front cover occupies on this page.
 *
 * Shared by the print wrap (where the front is the right-hand third of a wide
 * page) and the teaser's standalone cover page (where it is the whole page),
 * so both put the name in exactly the same place relative to the artwork.
 */
function drawCoverName(
  page: PDFPage,
  args: {
    meta: BookMeta;
    layoutId: CoverLayoutId;
    nameFont: PDFFont;
    artLeft: number;
    artWidth: number;
    artHeight: number;
  },
): void {
  const { meta, layoutId, nameFont, artLeft, artWidth, artHeight } = args;

  const petName = meta.petName.trim();
  // An unnamed book prints no name. The editor's "Type name here" prompt
  // used to end up in the file.
  if (!petName) return;
  const anchor = meta.coverNameAnchor ?? defaultNameAnchor(layoutId);
  const nameColor = coverTextTone(layoutId) === "dark" ? brandRgb(resolvePalette(meta).ink) : PAPER;

  // Large, but never wider than the cover: a long name steps down to fit
  // rather than running off the edge.
  let nameSize = (meta.coverNameSize ?? DEFAULT_COVER_NAME_SIZE) * 15;
  const maxWidth = artWidth * 0.84;
  while (nameFont.widthOfTextAtSize(petName, nameSize) > maxWidth && nameSize > 14) {
    nameSize -= 1;
  }

  const [row, col] = anchor.split("-") as [string, string];
  const yPct = row === "top" ? 14 : row === "bottom" ? 87 : 50;
  const EDGE_INSET_PCT = 8;
  const y = artHeight - (yPct / 100) * artHeight;

  if (col === "left") {
    drawLeftText(page, petName, nameFont, nameSize, nameColor, {
      x: artLeft + (EDGE_INSET_PCT / 100) * artWidth,
      y,
    });
  } else if (col === "right") {
    drawRightText(page, petName, nameFont, nameSize, nameColor, {
      x: artLeft + ((100 - EDGE_INSET_PCT) / 100) * artWidth,
      y,
    });
  } else {
    drawCenteredText(page, petName, nameFont, nameSize, nameColor, {
      x: artLeft + 0.5 * artWidth,
      y,
    });
  }
}

/**
 * Draws the front cover alone, filling an existing page.
 *
 * The teaser PDF opens on the cover rather than the title page, because the
 * cover is the one page with the customer's pet looking back at them — it is
 * the most persuasive thing in the file and belongs first. The print wrap
 * cannot be reused for that: it is one wide page carrying front, spine, and
 * back together.
 */
export async function drawFrontCoverPage(
  pdf: PDFDocument,
  page: PDFPage,
  args: { meta: BookMeta; targetPpi?: number },
): Promise<void> {
  const { meta, targetPpi = 150 } = args;
  const { width, height } = page.getSize();

  const fonts = await loadBookFonts(pdf);

  const layoutId: CoverLayoutId = meta.coverLayoutId ?? DEFAULT_COVER_LAYOUT;
  const fontId: CoverFontId = meta.coverFontId ?? DEFAULT_COVER_FONT;
  const coverFile = meta.coverPhotoId
    ? assetStore.getFile(meta.coverPhotoId)
    : undefined;

  await drawCoverLayout(pdf, page, {
    layoutId,
    artLeft: 0,
    artWidth: width,
    artHeight: height,
    coverFile,
    targetPpi,
    meta,
    palette: resolvePalette(meta),
    fonts,
  });

  const nameFont = coverNameFont(fontId, fonts, meta.coverNameBold ?? true);

  drawCoverName(page, {
    meta,
    layoutId,
    nameFont,
    artLeft: 0,
    artWidth: width,
    artHeight: height,
  });
}

/**
 * Draws the front-cover background for the chosen layout: photo placement
 * plus any color band/margin/scrim. Mirrors `CoverLayoutChrome` (the
 * on-screen version) so the print file matches what the customer designed.
 * The ourTailTales mark stays off the front cover — see the back-cover
 * colophon below for where it lives instead.
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
    meta: BookMeta;
    palette: BookPalette;
    fonts: BookFonts;
  },
): Promise<void> {
  const { layoutId, artLeft, artWidth, artHeight, coverFile, targetPpi, meta, palette, fonts } = args;
  const full: Rect = { x: artLeft, y: 0, width: artWidth, height: artHeight };

  switch (layoutId) {
    case "minimal": {
      await drawPhotoOrFallback(pdf, page, coverFile, targetPpi, full);
      page.drawRectangle({ ...full, color: SCRIM, opacity: 0.4 });
      return;
    }

    case "editorial": {
      await drawPhotoOrFallback(pdf, page, coverFile, targetPpi, full);
      // A bold ink title band across the vertical middle — mirrors
      // `CoverLayoutChrome`'s "editorial" case (top 40%, height 27%).
      const bandHeight = artHeight * 0.27;
      const bandBottomY = artHeight * (1 - 0.4) - bandHeight;
      page.drawRectangle({
        x: artLeft,
        y: bandBottomY,
        width: artWidth,
        height: bandHeight,
        color: SCRIM,
        opacity: 0.68,
      });
      return;
    }

    case "portrait": {
      // The photograph as a framed print on the book's own paper, the name
      // set on the paper beneath it.
      page.drawRectangle({ ...full, color: brandRgb(palette.paper) });
      const window: Rect = {
        x: artLeft + PORTRAIT_WINDOW.x * artWidth,
        y: artHeight - (PORTRAIT_WINDOW.y + PORTRAIT_WINDOW.h) * artHeight,
        width: PORTRAIT_WINDOW.w * artWidth,
        height: PORTRAIT_WINDOW.h * artHeight,
      };
      const mat = PORTRAIT_MAT * artWidth;
      page.drawRectangle({
        x: window.x - mat,
        y: window.y - mat,
        width: window.width + mat * 2,
        height: window.height + mat * 2,
        color: PAPER,
      });
      await drawPhotoOrFallback(pdf, page, coverFile, targetPpi, window);
      drawPlate(page, { meta, palette, fonts, artLeft, artWidth, artHeight });
      return;
    }

    case "keepsake": {
      page.drawRectangle({ ...full, color: brandRgb(palette.paper) });
      const ink = brandRgb(palette.inkSoft);
      KEEPSAKE_RULES.forEach((inset, index) => {
        page.drawRectangle({
          x: artLeft + inset * artWidth,
          y: inset * artHeight,
          width: artWidth * (1 - inset * 2),
          height: artHeight * (1 - inset * 2),
          borderColor: ink,
          borderWidth: index === 0 ? 1.6 : 0.8,
          borderOpacity: index === 0 ? 0.45 : 0.32,
        });
      });
      const paw = KEEPSAKE_PAW.size * artWidth;
      page.drawSvgPath(DOODLE_PATHS.paw.d, {
        x: artLeft + artWidth / 2 - paw / 2,
        y: artHeight - KEEPSAKE_PAW.cy * artHeight + paw / 2,
        scale: paw / 24,
        color: brandRgb(palette.accent),
        opacity: 0.85,
        borderWidth: DOODLE_STROKE,
      });
      drawPlate(page, { meta, palette, fonts, artLeft, artWidth, artHeight });
      return;
    }

    case "monogram": {
      page.drawRectangle({ ...full, color: brandRgb(palette.paper) });
      const initial = meta.petName.trim().slice(0, 1).toUpperCase();
      if (initial) {
        const size = MONOGRAM_LETTER.size * artWidth;
        const width = fonts.serif.widthOfTextAtSize(initial, size);
        page.drawText(drawable(fonts.serif, initial), {
          x: artLeft + artWidth / 2 - width / 2,
          y: artHeight - MONOGRAM_LETTER.cy * artHeight - size * 0.35,
          size,
          font: fonts.serif,
          color: brandRgb(palette.accent),
          opacity: MONOGRAM_LETTER.opacity,
        });
      }
      drawPlate(page, { meta, palette, fonts, artLeft, artWidth, artHeight });
      return;
    }

    case "classic":
    default: {
      await drawPhotoOrFallback(pdf, page, coverFile, targetPpi, full);
      await drawScrim(pdf, page, artLeft, artWidth, artHeight * CLASSIC_SCRIM_HEIGHT, 0);
      return;
    }
  }
}

/**
 * The small rule and the years under it, on the covers whose name sits on
 * paper rather than on a photograph. Mirrors `PlateRule`/`PlateYears` in
 * `CoverLayoutChrome`.
 */
function drawPlate(
  page: PDFPage,
  args: {
    meta: BookMeta;
    palette: BookPalette;
    fonts: BookFonts;
    artLeft: number;
    artWidth: number;
    artHeight: number;
  },
): void {
  const { meta, palette, fonts, artLeft, artWidth, artHeight } = args;
  const centerX = artLeft + artWidth / 2;

  page.drawLine({
    start: {
      x: centerX - PLATE_RULE_HALF_WIDTH * artWidth,
      y: artHeight - PLATE_RULE_Y * artHeight,
    },
    end: {
      x: centerX + PLATE_RULE_HALF_WIDTH * artWidth,
      y: artHeight - PLATE_RULE_Y * artHeight,
    },
    thickness: 0.9,
    color: brandRgb(palette.accent),
    opacity: 0.7,
  });

  const years = lifespanText(meta);
  if (!years) return;
  const size = artWidth * 0.032;
  const tracking = size * 0.34;
  const text = drawable(fonts.sans, years);
  const width =
    fonts.sans.widthOfTextAtSize(text, size) + tracking * Math.max(0, [...text].length - 1);
  let cursor = centerX - width / 2;
  for (const character of [...text]) {
    page.drawText(character, {
      x: cursor,
      y: artHeight - PLATE_YEARS_Y * artHeight - size * 0.8,
      size,
      font: fonts.sans,
      color: brandRgb(palette.inkSoft),
    });
    cursor += fonts.sans.widthOfTextAtSize(character, size) + tracking;
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
 * The classic scrim: one embedded alpha ramp stretched over the band. It used
 * to be 28 stacked translucent bands, and wherever two overlapped the opacity
 * doubled, so the "gradient" printed as a set of dark stripes.
 */
async function drawScrim(
  pdf: PDFDocument,
  page: PDFPage,
  x: number,
  width: number,
  height: number,
  baseY: number,
): Promise<void> {
  const image = await pdf.embedPng(
    verticalAlphaRampPng(hexToRgb01(brand.colors.ink), [...CLASSIC_SCRIM_STOPS]),
  );
  page.drawImage(image, { x, y: baseY, width, height });
}

function drawCenteredText(
  page: PDFPage,
  text: string,
  font: PDFFont,
  size: number,
  color: ReturnType<typeof rgb>,
  center: { x: number; y: number; opacity?: number },
): void {
  text = drawable(font, text);
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

/** Left-aligned text — x is the left edge of the text. */
function drawLeftText(
  page: PDFPage,
  text: string,
  font: PDFFont,
  size: number,
  color: ReturnType<typeof rgb>,
  pos: { x: number; y: number; opacity?: number },
): void {
  text = drawable(font, text);
  page.drawText(text, {
    x: pos.x,
    y: pos.y - size * 0.35,
    font,
    size,
    color,
    opacity: pos.opacity ?? 1,
  });
}

/** Right-aligned text — x is the right edge of the text. */
function drawRightText(
  page: PDFPage,
  text: string,
  font: PDFFont,
  size: number,
  color: ReturnType<typeof rgb>,
  pos: { x: number; y: number; opacity?: number },
): void {
  text = drawable(font, text);
  const textWidth = font.widthOfTextAtSize(text, size);
  page.drawText(text, {
    x: pos.x - textWidth,
    y: pos.y - size * 0.35,
    font,
    size,
    color,
    opacity: pos.opacity ?? 1,
  });
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

const WARNING_RED = rgb(0.86, 0.15, 0.15);

/**
 * "EXPIRES IN 30 DAYS", in big red letters across the top of the teaser's
 * cover, with a line under it saying how to keep the book.
 *
 * A file cannot count down, so the headline is true on the day it was made
 * and the subtitle carries the absolute date, which stays true.
 */
export async function drawExpiryNotice(
  pdf: PDFDocument,
  page: PDFPage,
  args: { expiresAt: Date; top: number; left: number; width: number },
): Promise<void> {
  const { expiresAt, top, left, width } = args;
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const regular = await pdf.embedFont(StandardFonts.Helvetica);

  const headline = expiryHeadline(expiresAt);
  const subtitle = `Create a free account at ${brand.domain} to save this book, it expires ${formatExpiryDate(expiresAt)}.`;

  const bandHeight = 92;
  page.drawRectangle({
    x: left,
    y: top - bandHeight,
    width,
    height: bandHeight,
    color: PAPER,
    opacity: 0.94,
  });

  const maxWidth = width * 0.9;
  let headlineSize = 40;
  while (bold.widthOfTextAtSize(headline, headlineSize) > maxWidth && headlineSize > 18) {
    headlineSize -= 1;
  }
  let subtitleSize = 11;
  while (regular.widthOfTextAtSize(subtitle, subtitleSize) > maxWidth && subtitleSize > 7) {
    subtitleSize -= 0.5;
  }

  const centerX = left + width / 2;
  page.drawText(headline, {
    x: centerX - bold.widthOfTextAtSize(headline, headlineSize) / 2,
    y: top - 22 - headlineSize * 0.72,
    size: headlineSize,
    font: bold,
    color: WARNING_RED,
  });
  page.drawText(subtitle, {
    x: centerX - regular.widthOfTextAtSize(subtitle, subtitleSize) / 2,
    y: top - bandHeight + 16,
    size: subtitleSize,
    font: regular,
    color: INK,
  });
}
