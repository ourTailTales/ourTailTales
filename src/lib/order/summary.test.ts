import { describe, expect, it } from "vitest";

import { orderSummary } from "@/lib/order/summary";
import {
  BASE_CHAPTERS,
  BASE_PRICE,
  PRICE_PER_EXTRA_CHAPTER,
  MIN_PRINTABLE_INTERIOR_PAGES,
} from "@/lib/pricing";
import { VIDEO_MEMORIES_PER_PACK } from "@/lib/video-memory/config";

const placementsFor = (videoIds: string[]) =>
  videoIds.map((videoAssetId) => ({ videoAssetId }));

describe("what the finished book costs before shipping", () => {
  it("quotes the base book with nothing added", () => {
    const summary = orderSummary({
      chapterCount: BASE_CHAPTERS,
      pageCount: 54,
      placements: [],
    });
    expect(summary.bookPrice).toBe(BASE_PRICE);
    expect(summary.videoMemoryPackCount).toBe(0);
    expect(summary.videoMemoryPrice).toBe(0);
    expect(summary.subtotal).toBe(BASE_PRICE);
    expect(summary.interiorPages).toBe(54);
  });

  it("charges for the chapters past the base five", () => {
    const summary = orderSummary({
      chapterCount: BASE_CHAPTERS + 3,
      pageCount: 84,
      placements: [],
    });
    // Rounded to the cent, which is what `bookPrice` promises and what raw
    // floating-point addition of 49.99 and three 4.99s does not give.
    expect(summary.bookPrice).toBeCloseTo(BASE_PRICE + 3 * PRICE_PER_EXTRA_CHAPTER, 2);
    expect(summary.bookPrice).toBe(64.96);
    expect(summary.subtotal).toBe(summary.bookPrice);
  });

  it("counts a pack for the videos that have a QR code in the book", () => {
    const summary = orderSummary({
      chapterCount: BASE_CHAPTERS,
      pageCount: 54,
      placements: placementsFor(["a", "b", "c"]),
    });
    expect(summary.videoMemoryCount).toBe(3);
    expect(summary.videoMemoryPackCount).toBe(1);
    expect(summary.subtotal).toBe(
      Math.round((summary.bookPrice + summary.videoMemoryPrice) * 100) / 100,
    );
  });

  it("counts a video once however many times its code is printed", () => {
    const summary = orderSummary({
      chapterCount: BASE_CHAPTERS,
      pageCount: 54,
      placements: placementsFor(["a", "a", "a", "b"]),
    });
    expect(summary.videoMemoryCount).toBe(2);
    expect(summary.videoMemoryPackCount).toBe(1);
  });

  it("opens a second pack one video past the first one's capacity", () => {
    const ids = Array.from({ length: VIDEO_MEMORIES_PER_PACK + 1 }, (_, i) => `v${i}`);
    const full = orderSummary({
      chapterCount: BASE_CHAPTERS,
      pageCount: 54,
      placements: placementsFor(ids.slice(0, VIDEO_MEMORIES_PER_PACK)),
    });
    const over = orderSummary({
      chapterCount: BASE_CHAPTERS,
      pageCount: 54,
      placements: placementsFor(ids),
    });
    expect(full.videoMemoryPackCount).toBe(1);
    expect(over.videoMemoryPackCount).toBe(2);
    expect(over.videoMemoryPrice).toBe(full.videoMemoryPrice * 2);
  });

  it("pads a short book up to what the printer will bind", () => {
    const summary = orderSummary({
      chapterCount: BASE_CHAPTERS,
      pageCount: 19,
      placements: [],
    });
    expect(summary.interiorPages).toBe(MIN_PRINTABLE_INTERIOR_PAGES);
  });

  it("orders an even number of pages, because a leaf has two sides", () => {
    const summary = orderSummary({
      chapterCount: BASE_CHAPTERS,
      pageCount: 41,
      placements: [],
    });
    expect(summary.interiorPages % 2).toBe(0);
  });
});
