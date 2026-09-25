import { bookPrice, orderedInteriorPages } from "@/lib/pricing";
import { includedUniqueVideoCount } from "@/lib/video-memory/count";
import { centsToUsd, videoMemoryQuote } from "@/lib/video-memory/pricing";
import type { VideoMemoryPlacement } from "@/types/video-memory";

/**
 * What the book being finished will cost, before shipping.
 *
 * Quoted from the same functions the order row is written from — `bookPrice`
 * and `orderedInteriorPages` in `pricing`, `videoMemoryQuote` for the packs —
 * so the figures somebody reads before they commit are the figures the
 * checkout then charges. Shipping is the one number that cannot be known here:
 * it depends on an address nobody has given yet, and is quoted at checkout
 * against the real parcel.
 */
export type OrderSummary = {
  chapterCount: number;
  /** Pages that will actually be printed, blank leaves at the back included. */
  interiorPages: number;
  bookPrice: number;
  /** Unique videos with at least one QR code in the book. */
  videoMemoryCount: number;
  videoMemoryPackCount: number;
  videoMemoryPrice: number;
  /** Everything but shipping. */
  subtotal: number;
};

export function orderSummary(args: {
  chapterCount: number;
  /** How many pages the book came to, cover excluded. */
  pageCount: number;
  placements: Pick<VideoMemoryPlacement, "videoAssetId">[];
}): OrderSummary {
  const book = bookPrice(args.chapterCount);
  const videoMemoryCount = includedUniqueVideoCount(args.placements);
  const quote = videoMemoryQuote(videoMemoryCount);
  const memories = centsToUsd(quote.totalCents);
  return {
    chapterCount: args.chapterCount,
    interiorPages: orderedInteriorPages(args.pageCount, args.chapterCount),
    bookPrice: book,
    videoMemoryCount,
    videoMemoryPackCount: quote.packCount,
    videoMemoryPrice: memories,
    subtotal: Math.round((book + memories) * 100) / 100,
  };
}
