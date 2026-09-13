import { PDFDocument } from "pdf-lib";

import { PAGE_INCHES } from "@/lib/book/layouts";
import type { VideoMemoryPlacement } from "@/types/video-memory";

const PT_PER_INCH = 72;
const PAGE_PT = PAGE_INCHES * PT_PER_INCH;

export async function stampQrCodes(args: {
  frozenPdf: Uint8Array;
  placements: VideoMemoryPlacement[];
  qrByAssetId: Map<string, Uint8Array>;
  pageNumberById?: Map<string, number>;
}): Promise<Uint8Array> {
  const pdf = await PDFDocument.load(args.frozenPdf);
  const pages = pdf.getPages();

  for (const placement of args.placements) {
    const png = args.qrByAssetId.get(placement.videoAssetId);
    if (!png) throw new Error("qr_missing_for_placement");
    const pageIndex = pageIndexForPlacement(
      placement,
      pages.length,
      args.pageNumberById,
    );
    const page = pages[pageIndex];
    if (!page) throw new Error("qr_page_missing");
    const image = await pdf.embedPng(png);
    page.drawImage(image, {
      x: placement.x * PAGE_PT,
      y: PAGE_PT - (placement.y + placement.height) * PAGE_PT,
      width: placement.width * PAGE_PT,
      height: placement.height * PAGE_PT,
    });
  }

  return pdf.save();
}

export function pageIndexForPlacement(
  placement: Pick<VideoMemoryPlacement, "pageId">,
  pageCount: number,
  pageNumberById?: Map<string, number>,
): number {
  const mapped = pageNumberById?.get(placement.pageId);
  if (mapped !== undefined) {
    return stampPageIndex(mapped, pageCount);
  }
  const match = placement.pageId.match(/(\d+)$/);
  if (match) {
    const fromId = Number(match[1]);
    if (fromId >= 1 && fromId <= pageCount) return fromId - 1;
  }
  return 0;
}

export function stampPageIndex(pageNumber: number, pageCount?: number): number {
  const index = Math.max(0, pageNumber - 1);
  if (pageCount === undefined) return index;
  return Math.min(index, Math.max(0, pageCount - 1));
}
