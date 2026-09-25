import { TEASER_DESIGN_ID, withDesign } from "@/lib/book/design";
import { renderInteriorPdf } from "@/lib/book/interior-pdf";
import { summarizeTeaser, teaserPages } from "@/lib/book/teaser";
import type { BookMeta, BookPage, Chapter } from "@/types/book";
import type { PhotoAsset } from "@/types/photo";

/** Screen-quality only: neither of these files is print ready. */
const TEASER_PPI = 130;
const FULL_PREVIEW_PPI = 96;

export const SAMPLE_WATERMARK = "OURTAILTALES PREVIEW";

/**
 * The free book — front cover, the first nine interior pages, and a closing
 * page saying what is still to come.
 *
 * Rendered entirely in the browser from the same renderer that produces the
 * print file, so no photo leaves the device. Deliberately *not* watermarked
 * and deliberately a little sharper than the full preview: this is the thing
 * that has to make someone want the book, and a stamp across their pet's face
 * is a strange way to ask. What is withheld is length, not quality.
 *
 * Cropped to the 8.5in trim so it reads as the finished book rather than as a
 * printer's file with bleed still attached.
 *
 * Always set in the scrapbook design, whatever the book is set to: the free
 * book is everyone's first look, and the other designs come with an account.
 */
export async function renderTeaserPdf(args: {
  pages: BookPage[];
  chapters: Chapter[];
  meta: BookMeta;
  photos: Map<string, PhotoAsset>;
  /** When the banked preview expires; printed in red across the cover. */
  expiresAt?: Date;
  onProgress?: (completed: number, total: number) => void;
}): Promise<Blob> {
  const summary = summarizeTeaser(args.pages, args.chapters);

  const { bytes } = await renderInteriorPdf({
    pages: teaserPages(args.pages),
    chapters: args.chapters,
    meta: withDesign(args.meta, TEASER_DESIGN_ID),
    photos: args.photos,
    placements: [],
    targetPpi: TEASER_PPI,
    jpegQuality: 0.82,
    frontCover: true,
    cropToTrim: true,
    expiresAt: args.expiresAt,
    lockedNotice: summary.complete
      ? undefined
      : {
          hiddenPages: summary.hiddenPages,
          hiddenChapters: summary.hiddenChapters,
        },
    onProgress: args.onProgress,
  });

  return new Blob([bytes as unknown as BlobPart], { type: "application/pdf" });
}

/**
 * The whole book at screen resolution, watermarked — what an account holder
 * reads and downloads before buying. The watermark belongs here rather than on
 * the teaser: this copy is complete, so the only thing left to sell is a clean
 * file and a printed object.
 */
export async function renderFullPreviewPdf(args: {
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
    targetPpi: FULL_PREVIEW_PPI,
    jpegQuality: 0.7,
    frontCover: true,
    cropToTrim: true,
    watermark: SAMPLE_WATERMARK,
    onProgress: args.onProgress,
  });

  return new Blob([bytes as unknown as BlobPart], { type: "application/pdf" });
}

export function teaserFileName(petName: string): string {
  return `ourtailtales-${slug(petName)}-first-pages.pdf`;
}

export function previewFileName(petName: string): string {
  return `ourtailtales-${slug(petName)}-story.pdf`;
}

function slug(petName: string): string {
  return (
    petName
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "pet"
  );
}
