import {
  PDFDocument,
  degrees,
  rgb,
  type PDFFont,
  type PDFImage,
  type PDFPage,
} from "pdf-lib";

import { drawExpiryNotice, drawFrontCoverPage } from "@/lib/book/cover-pdf";
import { BLEED_INCHES, PAGE_INCHES, TRIM_INCHES } from "@/lib/book/layouts";
import { drawable, loadBookFonts, type BookFonts } from "@/lib/book/pdf-fonts";
import {
  CLOSING_TEXT,
  DEDICATION_CARD,
  OPENER_CARD,
  OPENER_STICKER,
  OPENER_TEXT,
  OPENER_TYPE,
  PAPER as SCRAPBOOK_PAPER,
  TITLE_TEXT,
  dedicationType,
  designPage,
  photoCaption,
  photoWindow,
  type DesignContext,
  type Print,
} from "@/lib/book/scrapbook";
import {
  drawCard,
  drawDoodle,
  drawPrint,
  drawScrap,
  drawSticker,
  drawTape,
  hex,
} from "@/lib/book/scrapbook-pdf";
import { CLOSING_LINE, possessivePetName, titlePageHeading } from "@/lib/book/pagination";
import { brand, hexToRgb01 } from "@/lib/brand";
import * as assetStore from "@/lib/photo/assetStore";
import { rasterizeForPlacement } from "@/lib/photo/pipeline";
import type { BookMeta, BookPage, Chapter, Slot } from "@/types/book";
import type { PhotoAsset } from "@/types/photo";
import type { VideoMemoryPlacement } from "@/types/video-memory";

const PT_PER_INCH = 72;
const PAGE_PT = PAGE_INCHES * PT_PER_INCH; // 630pt for an 8.75in bleed page
const TRIM_PT = TRIM_INCHES * PT_PER_INCH; // 612pt — the finished 8.5in page
const BLEED_PT = BLEED_INCHES * PT_PER_INCH; // 9pt trimmed off each edge

function brandRgb(hex: string) {
  const { r, g, b } = hexToRgb01(hex);
  return rgb(r, g, b);
}

const PAPER = brandRgb(brand.colors.white);
const INK = brandRgb(brand.colors.ink);
const INK_SOFT = brandRgb(brand.colors.inkSoft);
const INK_FAINT = brandRgb(brand.colors.inkFaint);
const ACCENT = brandRgb(brand.colors.periwinkle);

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
  /**
   * Crop every page to the 8.5in trim.
   *
   * The print file carries 0.125in of bleed on each edge that the binder cuts
   * away. On a screen nothing cuts it, so an uncropped preview shows a ragged
   * extra margin the finished book does not have. Set for anything a customer
   * reads rather than anything a printer receives.
   */
  cropToTrim?: boolean;
  /** Open on the front cover, drawn from `meta`, before the first interior page. */
  frontCover?: boolean;
  /** Close on a page saying what the rest of the book holds. */
  lockedNotice?: LockedNotice;
  /**
   * Stamp "EXPIRES IN N DAYS" across the top of the front cover. Free
   * previews only: the file is the one copy of the book many people keep,
   * and it has to say plainly that the book behind it will not wait.
   */
  expiresAt?: Date;
  /**
   * Pad with blank pages up to exactly this many interior pages. The print
   * order is sized from the chapter count alone (`luluInteriorPages`), and a
   * book with no dedication has one page fewer than that; the blank goes on
   * the back of the title page, where a book would put one anyway.
   */
  padToPageCount?: number;
  placements?: VideoMemoryPlacement[];
  onProgress?: (completed: number, total: number) => void;
};

export type LockedNotice = {
  /** Interior pages this file leaves out. */
  hiddenPages: number;
  /** Chapters this file leaves out. */
  hiddenChapters: number;
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
    cropToTrim = false,
    frontCover = false,
    lockedNotice,
    expiresAt,
    padToPageCount,
    placements = [],
    onProgress,
  } = options;

  const pdf = await PDFDocument.create();
  pdf.setTitle(meta.petName ? `${meta.petName}, ourTailTales` : "ourTailTales");
  pdf.setProducer("ourTailTales");
  pdf.setCreator("ourTailTales");

  const fonts = await loadBookFonts(pdf);

  const chaptersById = new Map(chapters.map((chapter) => [chapter.id, chapter]));
  const selected: (BookPage | null)[] = pageLimit
    ? pages.slice(0, pageLimit)
    : [...pages];
  if (padToPageCount && selected.length < padToPageCount) {
    const blanks = padToPageCount - selected.length;
    selected.splice(Math.min(1, selected.length), 0, ...Array(blanks).fill(null));
  }
  const lowResWarnings: LowResWarning[] = [];

  /** Every page is laid out on the full bleed page; cropping only changes what a reader sees. */
  const addPage = (): PDFPage => {
    const page = pdf.addPage([PAGE_PT, PAGE_PT]);
    if (cropToTrim) page.setCropBox(BLEED_PT, BLEED_PT, TRIM_PT, TRIM_PT);
    return page;
  };

  if (frontCover) {
    const page = addPage();
    await drawFrontCoverPage(pdf, page, { meta, targetPpi });
    if (expiresAt) {
      await drawExpiryNotice(pdf, page, {
        expiresAt,
        // Inside the trim, so cropping never cuts the warning in half.
        top: PAGE_PT - (cropToTrim ? BLEED_PT : 0),
        left: cropToTrim ? BLEED_PT : 0,
        width: cropToTrim ? TRIM_PT : PAGE_PT,
      });
    }
    await nextTick();
  }

  for (const [index, bookPage] of selected.entries()) {
    const page = addPage();
    page.drawRectangle({
      x: 0,
      y: 0,
      width: PAGE_PT,
      height: PAGE_PT,
      color: bookPage ? hex(SCRAPBOOK_PAPER) : PAPER,
    });

    if (bookPage) {
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
    }

    if (watermark) drawWatermark(page, fonts.sans, watermark);
    onProgress?.(index + 1, selected.length);

    // Give the browser a frame between pages so the UI keeps painting.
    await nextTick();
  }

  if (lockedNotice) {
    const page = addPage();
    page.drawRectangle({ x: 0, y: 0, width: PAGE_PT, height: PAGE_PT, color: hex(SCRAPBOOK_PAPER) });
    drawLockedPage(page, fonts, meta, lockedNotice);
  }

  return {
    bytes: await pdf.save(),
    pageCount: pdf.getPageCount(),
    lowResWarnings,
  };
}

/**
 * The last page of the teaser: what is still behind the account.
 *
 * Deliberately a page of the book rather than an advert — same paper, same
 * type — so closing the file feels like reaching a door, not an ad break.
 */
function drawLockedPage(
  page: PDFPage,
  fonts: Fonts,
  meta: BookMeta,
  notice: LockedNotice,
): void {
  const name = meta.petName.trim();

  drawCentered(page, name ? `${possessivePetName(name)} story` : "Their story", {
    font: fonts.serifBold,
    size: 30,
    color: INK,
    baseline: PAGE_PT * 0.62,
  });

  drawCentered(page, "continues", {
    font: fonts.serifItalic,
    size: 30,
    color: INK,
    baseline: PAGE_PT * 0.555,
  });

  page.drawRectangle({
    x: PAGE_PT * 0.42,
    y: PAGE_PT * 0.5,
    width: PAGE_PT * 0.16,
    height: 1,
    color: ACCENT,
    opacity: 0.5,
  });

  const chapters =
    notice.hiddenChapters === 1 ? "1 more chapter" : `${notice.hiddenChapters} more chapters`;
  const pagesLine =
    notice.hiddenPages === 1 ? "1 more page" : `${notice.hiddenPages} more pages`;

  drawCentered(page, `${chapters} — ${pagesLine} — are written and waiting.`, {
    font: fonts.sans,
    size: 12,
    color: INK_SOFT,
    baseline: PAGE_PT * 0.44,
  });

  drawCentered(page, "Open the link in your email to read the rest.", {
    font: fonts.sans,
    size: 12,
    color: INK_SOFT,
    baseline: PAGE_PT * 0.405,
  });

  drawCentered(page, brand.domain, {
    font: fonts.sans,
    size: 9,
    color: INK_FAINT,
    baseline: PAGE_PT * 0.16,
  });
}

type Fonts = BookFonts;

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

/**
 * Every page is drawn from its scrapbook design (`scrapbook.ts`): paper
 * scraps, then the prints, then the tape over them, then doodles, then the
 * page's words. The same design drives the on-screen page, so the two agree.
 */
async function drawPage(context: DrawContext): Promise<void> {
  const design = designPage(context.bookPage, designContextFor(context.photos));
  const frame = { page: context.page, pagePt: PAGE_PT };

  for (const scrap of design.scraps) drawScrap(frame, scrap);

  switch (context.bookPage.kind) {
    case "dedication":
      drawCard(frame, DEDICATION_CARD);
      break;
    case "chapter-opener":
      drawCard(frame, OPENER_CARD);
      break;
  }

  for (const print of design.prints) {
    const image = await embedPrintPhoto(context, print);
    drawPrint(frame, print, { image, handFont: context.fonts.hand });
  }
  for (const print of design.prints) {
    for (const tape of print.tapes) drawTape(frame, tape);
  }
  if (context.bookPage.kind === "dedication") {
    drawTape(frame, {
      cx: DEDICATION_CARD.cx,
      cy: DEDICATION_CARD.cy - DEDICATION_CARD.h / 2,
      w: 0.13,
      h: 0.036,
      rotation: -3,
      color: brand.colors.sage,
      opacity: 0.82,
    });
  }
  for (const doodle of design.doodles) drawDoodle(frame, doodle);

  switch (context.bookPage.kind) {
    case "title":
      return drawTitleText(context);
    case "dedication":
      return drawDedicationText(context);
    case "chapter-opener":
      return drawOpenerText(context);
    case "closing":
      return drawClosingText(context);
    case "imprint":
      return drawImprintPage(context);
    default:
      return;
  }
}

export function designContextFor(photos: Map<string, PhotoAsset>): DesignContext {
  return {
    orientationOf: (id) => photos.get(id)?.orientation,
    captionOf: (id) => photoCaption(photos.get(id)?.capturedAt),
  };
}

function drawTitleText(context: DrawContext): void {
  const { page, meta, fonts } = context;

  const heading = drawable(fonts.hand, titlePageHeading(meta.petName));
  let size = TITLE_TEXT.headingSize;
  while (fonts.hand.widthOfTextAtSize(heading, size) > PAGE_PT * 0.78 && size > 28) {
    size -= 2;
  }
  drawCentered(page, heading, {
    font: fonts.hand,
    size,
    color: INK,
    baseline: PAGE_PT * (1 - TITLE_TEXT.headingBaseline),
  });

  const years = lifespanText(meta);
  if (years) {
    // A date stamp: tracked capitals inside a thin rounded outline.
    const text = years.toUpperCase();
    const tracking = 2.4;
    const textSize = 10;
    const textWidth =
      fonts.sans.widthOfTextAtSize(text, textSize) + tracking * (text.length - 1);
    const stampW = textWidth + 26;
    const stampH = 20;
    const centerY = PAGE_PT * (1 - TITLE_TEXT.yearsCy);
    const r = stampH / 2;
    const straight = stampW - stampH;
    page.drawSvgPath(
      `M${r} 0 L${r + straight} 0 A${r} ${r} 0 0 1 ${r + straight} ${stampH} L${r} ${stampH} A${r} ${r} 0 0 1 ${r} 0 Z`,
      {
        x: (PAGE_PT - stampW) / 2,
        y: centerY + stampH / 2,
        borderColor: ACCENT,
        borderWidth: 1,
        borderOpacity: 0.8,
      },
    );
    drawCenteredTracked(page, text, {
      font: fonts.sans,
      size: textSize,
      color: ACCENT,
      tracking,
      baseline: centerY - textSize * 0.35,
    });
  }

  drawCenteredTracked(page, "ourTailTales", {
    font: fonts.sans,
    size: 8.5,
    color: INK_FAINT,
    tracking: 3.4,
    baseline: PAGE_PT * (1 - TITLE_TEXT.brandBaseline),
  });
}

function drawDedicationText(context: DrawContext): void {
  const { page, meta, fonts } = context;
  const text = drawable(fonts.serifItalic, meta.dedication.trim());
  // No dedication, no page: pagination leaves it out.
  if (!text) return;

  const card = DEDICATION_CARD;
  const maxWidth = card.w * PAGE_PT * 0.8;
  const { size, leading } = dedicationType(text);
  const lines = wrapText(text, fonts.serifItalic, size, maxWidth);

  const firstBaseline =
    PAGE_PT * (1 - card.cy) + ((lines.length - 1) * leading) / 2 - size * 0.3;

  // Ruled like a note card, the rules sitting just under each line of words
  // and carrying on above and below to the card's edges.
  const cardTop = PAGE_PT * (1 - (card.cy - card.h / 2)) - 30;
  const cardBottom = PAGE_PT * (1 - (card.cy + card.h / 2)) + 20;
  const ruleOffset = size * 0.28;
  let rule = firstBaseline - ruleOffset;
  while (rule + leading < cardTop) rule += leading;
  for (; rule > cardBottom; rule -= leading) {
    page.drawLine({
      start: { x: PAGE_PT * (card.cx - card.w / 2) + 26, y: rule },
      end: { x: PAGE_PT * (card.cx + card.w / 2) - 26, y: rule },
      thickness: 0.5,
      color: ACCENT,
      opacity: 0.2,
    });
  }

  let baseline = firstBaseline;
  for (const line of lines) {
    drawCentered(page, line, { font: fonts.serifItalic, size, color: INK, baseline });
    baseline -= leading;
  }
}

function drawOpenerText(context: DrawContext): void {
  const { page, chapter, fonts } = context;
  const box = OPENER_TEXT;
  const left = (box.cx - box.w / 2) * PAGE_PT;
  const maxWidth = box.w * PAGE_PT;
  const boxTop = PAGE_PT * (1 - (box.cy - box.h / 2));
  const boxBottom = PAGE_PT * (1 - (box.cy + box.h / 2));

  if (chapter) {
    drawSticker(
      { page, pagePt: PAGE_PT },
      OPENER_STICKER,
      { text: String(chapter.index + 1), font: fonts.handBold, color: brand.colors.periwinkle },
    );
  }

  let cursor = boxTop - OPENER_TYPE.date;

  if (chapter?.dateLabel) {
    page.drawText(drawable(fonts.hand, chapter.dateLabel), {
      x: left,
      y: cursor,
      font: fonts.hand,
      size: OPENER_TYPE.date,
      color: ACCENT,
    });
    cursor -= OPENER_TYPE.title + 8;
  } else {
    cursor -= OPENER_TYPE.title - OPENER_TYPE.date;
  }

  const title = drawable(fonts.serifBold, chapter?.title ?? "");
  // Narrower than the card so a long title never runs under the sticker.
  for (const line of wrapText(title, fonts.serifBold, OPENER_TYPE.title, maxWidth - 48)) {
    page.drawText(line, {
      x: left,
      y: cursor,
      font: fonts.serifBold,
      size: OPENER_TYPE.title,
      color: INK,
    });
    cursor -= OPENER_TYPE.titleLeading;
  }

  cursor -= 6;

  const blurb = drawable(fonts.serif, chapter?.blurb ?? "");
  const room = Math.max(0, Math.floor((cursor - boxBottom) / OPENER_TYPE.blurbLeading) + 1);
  for (const line of fitLines(wrapText(blurb, fonts.serif, OPENER_TYPE.blurb, maxWidth), room, fonts.serif, OPENER_TYPE.blurb, maxWidth)) {
    page.drawText(line, {
      x: left,
      y: cursor,
      font: fonts.serif,
      size: OPENER_TYPE.blurb,
      color: INK_SOFT,
    });
    cursor -= OPENER_TYPE.blurbLeading;
  }
}

/**
 * At most `room` lines; if the text is cut, the last line ends on an
 * ellipsis at a word boundary rather than stopping mid-sentence.
 */
function fitLines(
  lines: string[],
  room: number,
  font: PDFFont,
  size: number,
  maxWidth: number,
): string[] {
  if (lines.length <= room) return lines;
  if (room <= 0) return [];
  const kept = lines.slice(0, room);
  let last = kept[room - 1]!;
  while (last && font.widthOfTextAtSize(`${last}…`, size) > maxWidth) {
    last = last.replace(/\s*\S+$/, "");
  }
  kept[room - 1] = `${last.replace(/[\s,;:—–-]+$/, "")}…`;
  return kept;
}

function drawClosingText(context: DrawContext): void {
  const { page, fonts } = context;
  drawCentered(page, CLOSING_LINE, {
    font: fonts.hand,
    size: CLOSING_TEXT.size,
    color: INK,
    baseline: PAGE_PT * (1 - CLOSING_TEXT.baseline),
  });
}

async function drawImprintPage(context: DrawContext): Promise<void> {
  const { page, meta, fonts } = context;

  drawCenteredTracked(page, "ourTailTales", {
    font: fonts.sans,
    size: 9,
    color: INK_FAINT,
    tracking: 3.4,
    baseline: PAGE_PT * 0.22,
  });

  const lines = [
    drawable(fonts.sans, `Made from ${possessivePetName(meta.petName)} own photographs.`),
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

/**
 * Embeds exactly one photo, sized for exactly one print's window. The
 * rasterized JPEG is dropped as soon as pdf-lib has copied it.
 */
async function embedPrintPhoto(
  context: DrawContext,
  print: Print,
): Promise<PDFImage | null> {
  const photoId = print.photoId;
  if (!photoId) return null;

  const photo = context.photos.get(photoId);
  const file = assetStore.getFile(photoId);
  if (!photo || !file) return null;

  const window = photoWindow(print);
  const widthInches = (window.w * PAGE_PT) / PT_PER_INCH;
  const heightInches = (window.h * PAGE_PT) / PT_PER_INCH;

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

    if (placement.ppi < LOW_PPI_THRESHOLD) {
      context.lowResWarnings.push({
        pageNumber: context.bookPage.pageNumber,
        photoId,
        fileName: photo.fileName,
        ppi: placement.ppi,
      });
    }
    return embedded;
  } catch {
    // A single unreadable original must not abandon the whole book.
    return null;
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
