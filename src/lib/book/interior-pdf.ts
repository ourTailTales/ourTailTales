import {
  PDFDocument,
  degrees,
  rgb,
  type RGB,
  type PDFFont,
  type PDFImage,
  type PDFPage,
} from "pdf-lib";

import { drawExpiryNotice, drawFrontCoverPage } from "@/lib/book/cover-pdf";
import { designContext, designPage } from "@/lib/book/design";
import { photoWindow, type Print } from "@/lib/book/design/primitives";
import { drawDesign, hex } from "@/lib/book/design-pdf";
import { BLEED_INCHES, PAGE_INCHES, TRIM_INCHES } from "@/lib/book/layouts";
import { resolvePalette, type BookPalette } from "@/lib/book/palette";
import { loadBookFonts, type BookFonts } from "@/lib/book/pdf-fonts";
import { possessivePetName } from "@/lib/book/pagination";
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
   * Pad with blank leaves up to exactly this many interior pages, at the
   * back of the book.
   *
   * The print order is sized from the chapter count alone
   * (`luluInteriorPages`) while the book itself is only as long as the
   * album fills, so the two rarely match exactly. Lulu requires the uploaded
   * interior to carry exactly the page count that was ordered.
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
  const palette = resolvePalette(meta);
  const colors = pageColors(palette);

  const chaptersById = new Map(chapters.map((chapter) => [chapter.id, chapter]));
  const selected: (BookPage | null)[] = pageLimit
    ? pages.slice(0, pageLimit)
    : [...pages];
  if (padToPageCount && selected.length < padToPageCount) {
    // At the back, where a printed book puts its blank leaves. They used to
    // go on the back of the title page, which put the padding of a short
    // book between its title and its first chapter.
    selected.push(...Array(padToPageCount - selected.length).fill(null));
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
    page.drawRectangle({ x: 0, y: 0, width: PAGE_PT, height: PAGE_PT, color: PAPER });

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
    page.drawRectangle({ x: 0, y: 0, width: PAGE_PT, height: PAGE_PT, color: hex(palette.paper) });
    drawLockedPage(page, fonts, colors, meta, lockedNotice);
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
  colors: PageColors,
  meta: BookMeta,
  notice: LockedNotice,
): void {
  const name = meta.petName.trim();

  drawCentered(page, name ? `${possessivePetName(name)} story` : "Their story", {
    font: fonts.serifBold,
    size: 30,
    color: colors.ink,
    baseline: PAGE_PT * 0.62,
  });

  drawCentered(page, "continues", {
    font: fonts.serifItalic,
    size: 30,
    color: colors.ink,
    baseline: PAGE_PT * 0.555,
  });

  page.drawRectangle({
    x: PAGE_PT * 0.42,
    y: PAGE_PT * 0.5,
    width: PAGE_PT * 0.16,
    height: 1,
    color: colors.accent,
    opacity: 0.5,
  });

  const chapters =
    notice.hiddenChapters === 1 ? "1 more chapter" : `${notice.hiddenChapters} more chapters`;
  const pagesLine =
    notice.hiddenPages === 1 ? "1 more page" : `${notice.hiddenPages} more pages`;

  drawCentered(page, `${chapters} — ${pagesLine} — are written and waiting.`, {
    font: fonts.sans,
    size: 12,
    color: colors.inkSoft,
    baseline: PAGE_PT * 0.44,
  });

  drawCentered(page, "Open the link in your email to read the rest.", {
    font: fonts.sans,
    size: 12,
    color: colors.inkSoft,
    baseline: PAGE_PT * 0.405,
  });

  drawCentered(page, brand.domain, {
    font: fonts.sans,
    size: 9,
    color: colors.inkFaint,
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

/** The palette's text colors, as pdf-lib colors. */
type PageColors = { ink: RGB; inkSoft: RGB; inkFaint: RGB; accent: RGB };

function pageColors(palette: BookPalette): PageColors {
  return {
    ink: hex(palette.ink),
    inkSoft: hex(palette.inkSoft),
    inkFaint: hex(palette.inkFaint),
    accent: hex(palette.accent),
  };
}

/**
 * Every page is drawn from the book's design (`lib/book/design`), the same
 * design that draws it on screen, so the two agree.
 */
async function drawPage(context: DrawContext): Promise<void> {
  const design = designPage(
    context.bookPage,
    designContext({ meta: context.meta, chapter: context.chapter, photos: context.photos }),
  );
  await drawDesign({ page: context.page, pagePt: PAGE_PT }, design, {
    fonts: context.fonts,
    imageFor: (print) => embedPrintPhoto(context, print),
  });
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

function nextTick(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}
