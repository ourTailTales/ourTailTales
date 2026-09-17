import { renderInteriorPdf } from "@/lib/book/interior-pdf";
import type { BookMeta, BookPage, Chapter } from "@/types/book";
import type { PhotoAsset } from "@/types/photo";
import type { VideoMemoryPlacement } from "@/types/video-memory";

const SAMPLE_PAGES = 5;

/** Screen-quality only: the free sample is not a print-ready file. */
const SAMPLE_PPI = 110;
const FREE_PREVIEW_PPI = 96;

export const SAMPLE_WATERMARK = "OURTAILTALES PREVIEW";

/**
 * Builds the free 5-page sample entirely in the browser, from the same renderer
 * that produces the print file. No photo ever leaves the device.
 */
export async function renderSamplePdf(args: {
  pages: BookPage[];
  chapters: Chapter[];
  meta: BookMeta;
  photos: Map<string, PhotoAsset>;
  placements?: VideoMemoryPlacement[];
  onProgress?: (completed: number, total: number) => void;
}): Promise<Blob> {
  const samplePages = pickSamplePages(args.pages);
  const sampleIds = new Set(samplePages.map((page) => page.id));
  const { bytes } = await renderInteriorPdf({
    pages: samplePages,
    chapters: args.chapters,
    meta: args.meta,
    photos: args.photos,
    placements: (args.placements ?? []).filter((placement) =>
      sampleIds.has(placement.pageId),
    ),
    targetPpi: SAMPLE_PPI,
    jpegQuality: 0.72,
    watermark: SAMPLE_WATERMARK,
    onProgress: args.onProgress,
  });

  return new Blob([bytes as unknown as BlobPart], { type: "application/pdf" });
}

/** Full-book, screen-resolution preview. It is deliberately not print ready. */
export async function renderFreePreviewPdf(args: {
  pages: BookPage[];
  chapters: Chapter[];
  meta: BookMeta;
  photos: Map<string, PhotoAsset>;
  onProgress?: (completed: number, total: number) => void;
}): Promise<Blob> {
  const { bytes } = await renderInteriorPdf({
    pages: args.pages,
    chapters: args.chapters,
    meta: args.meta,
    photos: args.photos,
    placements: [],
    targetPpi: FREE_PREVIEW_PPI,
    jpegQuality: 0.7,
    watermark: SAMPLE_WATERMARK,
    onProgress: args.onProgress,
  });

  return new Blob([bytes as unknown as BlobPart], { type: "application/pdf" });
}

/** Title page, the first chapter opener, then that chapter's opening spreads. */
function pickSamplePages(pages: BookPage[]): BookPage[] {
  const title = pages.find((page) => page.kind === "title");
  const opener = pages.find((page) => page.kind === "chapter-opener");
  const photoPages = pages.filter(
    (page) => page.kind === "photos" && page.chapterId === opener?.chapterId,
  );

  const chosen = [title, opener, ...photoPages].filter(
    (page): page is BookPage => page !== undefined,
  );

  return chosen.slice(0, SAMPLE_PAGES);
}

export function sampleFileName(petName: string): string {
  const slug =
    petName
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "pet";
  return `ourtailtales-${slug}-sample.pdf`;
}
