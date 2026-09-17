import {
  PDFDocument,
  StandardFonts,
  degrees,
  rgb,
  type PDFFont,
  type PDFPage,
} from "pdf-lib";

import { FIXED_SLOTS, LAYOUTS, PAGE_INCHES } from "@/lib/book/layouts";
import { CLOSING_LINE, possessivePetName } from "@/lib/book/pagination";
import { brand, hexToRgb01 } from "@/lib/brand";
import * as assetStore from "@/lib/photo/assetStore";
import { rasterizeForPlacement } from "@/lib/photo/pipeline";
import type { BookMeta, BookPage, Chapter, Slot } from "@/types/book";
import type { PhotoAsset } from "@/types/photo";
import type { VideoMemoryPlacement } from "@/types/video-memory";

const PT_PER_INCH = 72;
const PAGE_PT = PAGE_INCHES * PT_PER_INCH; // 630pt for an 8.75in bleed page

function brandRgb(hex: string) {
  const { r, g, b } = hexToRgb01(hex);
  return rgb(r, g, b);
}

const PAPER = brandRgb(brand.colors.white);
const INK = brandRgb(brand.colors.ink);
const INK_SOFT = brandRgb(brand.colors.inkSoft);
const INK_FAINT = brandRgb(brand.colors.inkFaint);
const ACCENT = brandRgb(brand.colors.periwinkle);
const BLANK_SLOT = brandRgb(brand.colors.memoryBlue);
const CHAPTER_FIELD = brandRgb(brand.colors.lavender);

/** Below this effective resolution a placement is flagged to the customer. */
export const LOW_PPI_THRESHOLD = 180;

export type LowResWarning = {
  pageNumber: number;
  photoId: string;
  fileName: string;
  ppi: number;
};

export type InteriorRenderOptions = {
  pages: BookPage[];
  chapters: Chapter[];
  meta: BookMeta;
  photos: Map<string, PhotoAsset>;
  /** 300 for print, ~110 for the emailed sample. */
  targetPpi?: number;
  jpegQuality?: number;
  /** Diagonal watermark text, used only for the free sample. */
  watermark?: string;
  /** Render only the first N pages, used only for the free sample. */
  pageLimit?: number;
  placements?: VideoMemoryPlacement[];
  onProgress?: (completed: number, total: number) => void;
};

export type InteriorRenderResult = {
  bytes: Uint8Array;
  pageCount: number;
  lowResWarnings: LowResWarning[];
};

/**
 * Renders the interior PDF one page at a time.
 *
 * Each placed photo is downsampled for its own slot, embedded, and released
 * before the next one is touched, so a 124-page book never holds more than a
 * single decoded image at a time.
 */
export async function renderInteriorPdf(
  options: InteriorRenderOptions,
): Promise<InteriorRenderResult> {
  const {
    pages,
    chapters,
    meta,
    photos,
    targetPpi = 300,
    jpegQuality = 0.9,
    watermark,
    pageLimit,
    placements = [],
    onProgress,
  } = options;

  const pdf = await PDFDocument.create();
  pdf.setTitle(meta.petName ? `${meta.petName} — ourTailTales` : "ourTailTales");
  pdf.setProducer("ourTailTales");
  pdf.setCreator("ourTailTales");

  const fonts = {
    display: await pdf.embedFont(StandardFonts.TimesRoman),
    displayItalic: await pdf.embedFont(StandardFonts.TimesRomanItalic),
    sans: await pdf.embedFont(StandardFonts.Helvetica),
  };

  const chaptersById = new Map(chapters.map((chapter) => [chapter.id, chapter]));
  const selected = pageLimit ? pages.slice(0, pageLimit) : pages;
  const lowResWarnings: LowResWarning[] = [];

  for (const [index, bookPage] of selected.entries()) {
    const page = pdf.addPage([PAGE_PT, PAGE_PT]);
    page.drawRectangle({
      x: 0,
      y: 0,
      width: PAGE_PT,
      height: PAGE_PT,
      color: PAPER,
    });

    await drawPage({
      pdf,
      page,
      bookPage,
      chapter: bookPage.chapterId
        ? chaptersById.get(bookPage.chapterId)
        : undefined,
      meta,
      photos,
      fonts,
      targetPpi,
      jpegQuality,
      lowResWarnings,
    });

    drawVideoMemoryPlaceholders(
      page,
      fonts.sans,
      placements.filter((placement) => placement.pageId === bookPage.id),
    );

    if (watermark) drawWatermark(page, fonts.sans, watermark);
    onProgress?.(index + 1, selected.length);

    // Give the browser a frame between pages so the UI keeps painting.
    await nextTick();
  }

  return {
    bytes: await pdf.save(),
    pageCount: selected.length,
    lowResWarnings,
  };
}

type Fonts = { display: PDFFont; displayItalic: PDFFont; sans: PDFFont };

type DrawContext = {
  pdf: PDFDocument;
  page: PDFPage;
  bookPage: BookPage;
  chapter?: Chapter;
  meta: BookMeta;
  photos: Map<string, PhotoAsset>;
  fonts: Fonts;
  targetPpi: number;
  jpegQuality: number;
  lowResWarnings: LowResWarning[];
};

async function drawPage(context: DrawContext): Promise<void> {
  switch (context.bookPage.kind) {
    case "title":
      return drawTitlePage(context);
    case "dedication":
      return drawDedicationPage(context);
    case "chapter-opener":
      return drawOpenerPage(context);
    case "closing":
      return drawClosingPage(context);
    case "imprint":
      return drawImprintPage(context);
    default:
      return drawPhotoPage(context);
  }
}

async function drawTitlePage(context: DrawContext): Promise<void> {
  const { page, meta, fonts } = context;

  drawCentered(page, meta.petName || "Their Story", {
    font: fonts.display,
    size: 46,
    color: INK,
    baseline: PAGE_PT * 0.74,
  });

  const years = lifespanText(meta);
  if (years) {
    drawCenteredTracked(page, years.toUpperCase(), {
      font: fonts.sans,
      size: 10.5,
      color: INK_FAINT,
      tracking: 2.6,
      baseline: PAGE_PT * 0.7,
    });
  }

  await drawSlotPhoto(context, FIXED_SLOTS.titleHero, context.bookPage.photoIds[0]);

  drawCenteredTracked(page, "OURTAILTALES", {
    font: fonts.sans,
    size: 8.5,
    color: INK_FAINT,
    tracking: 3.4,
    baseline: PAGE_PT * 0.085,
  });
}

async function drawDedicationPage(context: DrawContext): Promise<void> {
  const { page, meta, fonts } = context;
  const text = meta.dedication.trim();

  if (!text) {
    page.drawLine({
      start: { x: PAGE_PT * 0.41, y: PAGE_PT * 0.5 },
      end: { x: PAGE_PT * 0.59, y: PAGE_PT * 0.5 },
      thickness: 0.6,
      color: INK_FAINT,
    });
    return;
  }

  const maxWidth = PAGE_PT * 0.62;
  const size = text.length > 180 ? 14 : 17;
  const lines = wrapText(text, fonts.displayItalic, size, maxWidth);
  const leading = size * 1.6;
  let baseline = PAGE_PT * 0.5 + ((lines.length - 1) * leading) / 2;

  for (const line of lines) {
    drawCentered(page, line, {
      font: fonts.displayItalic,
      size,
      color: INK,
      baseline,
    });
    baseline -= leading;
  }
}

async function drawOpenerPage(context: DrawContext): Promise<void> {
  const { page, chapter, fonts } = context;
  const layout = LAYOUTS["chapter-opener"];

  await drawSlotPhoto(context, layout.slots[0], context.bookPage.photoIds[0]);

  const box = layout.textBox!;
  const left = box.x * PAGE_PT;
  const maxWidth = box.w * PAGE_PT;
  const boxTop = PAGE_PT - box.y * PAGE_PT;
  const boxBottom = PAGE_PT - (box.y + box.h) * PAGE_PT;

  // Soft pastel field behind chapter title / date / blurb.
  page.drawRectangle({
    x: left - 10,
    y: boxBottom - 8,
    width: maxWidth + 20,
    height: boxTop - boxBottom + 16,
    color: CHAPTER_FIELD,
    opacity: 0.55,
  });

  let cursor = boxTop - 26;

  if (chapter?.dateLabel) {
    drawTracked(page, chapter.dateLabel.toUpperCase(), {
      x: left,
      y: cursor,
      font: fonts.sans,
      size: 9,
      color: ACCENT,
      tracking: 2.4,
    });
    cursor -= 26;
  }

  const titleLines = wrapText(chapter?.title ?? "", fonts.display, 30, maxWidth);
  for (const line of titleLines) {
    page.drawText(line, {
      x: left,
      y: cursor,
      font: fonts.display,
      size: 30,
      color: INK,
    });
    cursor -= 34;
  }

  cursor -= 6;

  const blurbLines = wrapText(chapter?.blurb ?? "", fonts.sans, 10.5, maxWidth);
  for (const line of blurbLines) {
    if (cursor < boxBottom + 6) break;
    page.drawText(line, {
      x: left,
      y: cursor,
      font: fonts.sans,
      size: 10.5,
      color: INK_SOFT,
      lineHeight: 16,
    });
    cursor -= 16;
  }
}

async function drawClosingPage(context: DrawContext): Promise<void> {
  const { page, fonts } = context;
  await drawSlotPhoto(
    context,
    FIXED_SLOTS.closingHero,
    context.bookPage.photoIds[0],
  );
  drawCentered(page, CLOSING_LINE, {
    font: fonts.display,
    size: 20,
    color: INK,
    baseline: PAGE_PT * 0.1,
  });
}

async function drawImprintPage(context: DrawContext): Promise<void> {
  const { page, meta, fonts } = context;

  drawCenteredTracked(page, "OURTAILTALES", {
    font: fonts.sans,
    size: 9,
    color: INK_FAINT,
    tracking: 3.4,
    baseline: PAGE_PT * 0.22,
  });

  const lines = [
    `Made from ${possessivePetName(meta.petName)} own photographs.`,
    "Printed and bound on demand.",
  ];
  let baseline = PAGE_PT * 0.17;
  for (const line of lines) {
    drawCentered(page, line, {
      font: fonts.sans,
      size: 9,
      color: INK_FAINT,
      baseline,
    });
    baseline -= 14;
  }
}

async function drawPhotoPage(context: DrawContext): Promise<void> {
  const { bookPage } = context;
  if (!bookPage.layoutId) return;

  const layout = LAYOUTS[bookPage.layoutId];
  for (const [index, photoId] of bookPage.photoIds.entries()) {
    const slot = layout.slots[index];
    if (!slot) continue;
    await drawSlotPhoto(context, slot, photoId);
  }
}

/**
 * Embeds exactly one photo, sized for exactly one slot. The rasterized JPEG is
 * dropped as soon as pdf-lib has copied it.
 */
async function drawSlotPhoto(
  context: DrawContext,
  slot: Slot,
  photoId: string | undefined,
): Promise<void> {
  if (!photoId) return;

  const photo = context.photos.get(photoId);
  const file = assetStore.getFile(photoId);
  if (!photo || !file) return;

  const rect = slotRect(slot);
  const widthInches = rect.width / PT_PER_INCH;
  const heightInches = rect.height / PT_PER_INCH;

  try {
    const placement = await rasterizeForPlacement(
      file,
      widthInches,
      heightInches,
      context.targetPpi,
      context.jpegQuality,
    );

    const embedded = await context.pdf.embedJpg(
      new Uint8Array(await placement.blob.arrayBuffer()),
    );

    context.page.drawImage(embedded, rect);

    if (placement.ppi < LOW_PPI_THRESHOLD) {
      context.lowResWarnings.push({
        pageNumber: context.bookPage.pageNumber,
        photoId,
        fileName: photo.fileName,
        ppi: placement.ppi,
      });
    }
  } catch {
    // A single unreadable original must not abandon the whole book.
    context.page.drawRectangle({
      ...rect,
      color: BLANK_SLOT,
    });
  }
}

function drawVideoMemoryPlaceholders(
  page: PDFPage,
  font: PDFFont,
  placements: VideoMemoryPlacement[],
): void {
  for (const placement of placements) {
    const rect = slotRect({
      x: placement.x,
      y: placement.y,
      w: placement.width,
      h: placement.height,
    });
    page.drawRectangle({
      ...rect,
      color: brandRgb(brand.colors.memoryBlue),
    });
    page.drawRectangle({
      x: rect.x + 4,
      y: rect.y + 4,
      width: rect.width - 8,
      height: rect.height - 8,
      borderColor: INK_SOFT,
      borderWidth: 1,
    });
    const label = "Watch this memory";
    const size = 7;
    const width = font.widthOfTextAtSize(label, size);
    page.drawText(label, {
      x: rect.x + (rect.width - width) / 2,
      y: rect.y + 8,
      font,
      size,
      color: INK,
    });
  }
}

function slotRect(slot: Slot): {
  x: number;
  y: number;
  width: number;
  height: number;
} {
  return {
    x: slot.x * PAGE_PT,
    y: PAGE_PT - (slot.y + slot.h) * PAGE_PT,
    width: slot.w * PAGE_PT,
    height: slot.h * PAGE_PT,
  };
}

/* --------------------------------- typography -------------------------------- */

function drawCentered(
  page: PDFPage,
  text: string,
  options: { font: PDFFont; size: number; color: ReturnType<typeof rgb>; baseline: number },
): void {
  if (!text) return;
  const width = options.font.widthOfTextAtSize(text, options.size);
  page.drawText(text, {
    x: (PAGE_PT - width) / 2,
    y: options.baseline,
    font: options.font,
    size: options.size,
    color: options.color,
  });
}

/** pdf-lib has no letter-spacing, so tracked text is drawn glyph by glyph. */
function drawTracked(
  page: PDFPage,
  text: string,
  options: {
    x: number;
    y: number;
    font: PDFFont;
    size: number;
    color: ReturnType<typeof rgb>;
    tracking: number;
  },
): void {
  let cursor = options.x;
  for (const character of text) {
    page.drawText(character, {
      x: cursor,
      y: options.y,
      font: options.font,
      size: options.size,
      color: options.color,
    });
    cursor +=
      options.font.widthOfTextAtSize(character, options.size) + options.tracking;
  }
}

function drawCenteredTracked(
  page: PDFPage,
  text: string,
  options: {
    font: PDFFont;
    size: number;
    color: ReturnType<typeof rgb>;
    tracking: number;
    baseline: number;
  },
): void {
  if (!text) return;
  const width =
    options.font.widthOfTextAtSize(text, options.size) +
    options.tracking * (text.length - 1);
  drawTracked(page, text, {
    x: (PAGE_PT - width) / 2,
    y: options.baseline,
    font: options.font,
    size: options.size,
    color: options.color,
    tracking: options.tracking,
  });
}

function wrapText(
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

function drawWatermark(page: PDFPage, font: PDFFont, text: string): void {
  page.drawText(text, {
    x: PAGE_PT * 0.12,
    y: PAGE_PT * 0.28,
    font,
    size: 46,
    color: ACCENT,
    opacity: 0.16,
    rotate: degrees(38),
  });
}

function lifespanText(meta: BookMeta): string {
  if (meta.birthYear && meta.deathYear) {
    return `${meta.birthYear} – ${meta.deathYear}`;
  }
  return meta.birthYear || meta.deathYear || "";
}

function nextTick(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}
