import { describe, expect, it } from "vitest";

import {
  BASE_CHAPTERS,
  BASE_PRICE,
  CHAPTER_TIERS,
  MAX_CHAPTERS,
  MIN_PHOTOS_FOR_BOOK,
  MIN_PRINTABLE_INTERIOR_PAGES,
  PHOTOS_PER_CHAPTER_TARGET,
  bookPrice,
  luluInteriorPages,
  maxSupportedChapters,
  orderedInteriorPages,
  priceBreakdown,
  storedPriceBreakdown,
  storyPages,
  tierForChapterCount,
} from "@/lib/pricing";

describe("book pricing", () => {
  it("prices the five-chapter base book at the first band's rate", () => {
    expect(BASE_CHAPTERS).toBe(5);
    expect(BASE_PRICE).toBe(49.95);
    expect(storyPages(5)).toBe(50);
    expect(luluInteriorPages(5)).toBe(54);
    expect(bookPrice(5)).toBe(5 * CHAPTER_TIERS[0]!.ratePerChapter);
  });

  it("charges each chapter at its own band's rate, not the whole book at one", () => {
    // Nine chapters is the last of the first band; the tenth is the first of
    // the second, and only the tenth is charged at the cheaper rate.
    expect(bookPrice(9)).toBe(89.91);
    expect(bookPrice(10)).toBe(97.9);
    expect(bookPrice(24)).toBe(209.76);
    expect(bookPrice(25)).toBe(215.75);
    expect(bookPrice(MAX_CHAPTERS)).toBe(365.5);
  });

  it("never charges more for a shorter book", () => {
    // The trap a flat per-band rate falls into: at the boundary, one chapter
    // more would have cost less than one chapter fewer.
    for (let chapters = BASE_CHAPTERS; chapters < MAX_CHAPTERS; chapters += 1) {
      expect(bookPrice(chapters + 1)).toBeGreaterThan(bookPrice(chapters));
    }
  });

  it("caps at the longest book we bind", () => {
    expect(bookPrice(MAX_CHAPTERS + 10)).toBe(bookPrice(MAX_CHAPTERS));
  });

  it("leaves no gap or overlap between the bands", () => {
    expect(CHAPTER_TIERS[0]!.fromChapter).toBe(1);
    expect(CHAPTER_TIERS.at(-1)!.toChapter).toBe(MAX_CHAPTERS);
    for (const [index, tier] of CHAPTER_TIERS.slice(1).entries()) {
      expect(tier.fromChapter).toBe(CHAPTER_TIERS[index]!.toChapter + 1);
      // Longer books never cost more per chapter.
      expect(tier.ratePerChapter).toBeLessThan(CHAPTER_TIERS[index]!.ratePerChapter);
    }
  });

  it("breaks a price into the bands that made it", () => {
    const lines = priceBreakdown(12);
    expect(lines.map((line) => [line.tier.id, line.chapters])).toEqual([
      ["keepsake", 9],
      ["chronicle", 3],
    ]);
    expect(lines.reduce((total, line) => total + line.subtotal, 0)).toBeCloseTo(
      bookPrice(12),
      2,
    );
    // Bands the book never reaches are not printed on the invoice.
    expect(priceBreakdown(BASE_CHAPTERS)).toHaveLength(1);
  });

  it("names the band a book's last chapter falls in", () => {
    expect(tierForChapterCount(BASE_CHAPTERS).id).toBe("keepsake");
    expect(tierForChapterCount(9).id).toBe("keepsake");
    expect(tierForChapterCount(10).id).toBe("chronicle");
    expect(tierForChapterCount(MAX_CHAPTERS).id).toBe("archive");
  });

  it("will not explain an old total with today's rates", () => {
    expect(storedPriceBreakdown(12, bookPrice(12))).toHaveLength(2);
    // A price from before a rate change: the receipt shows the total alone.
    expect(storedPriceBreakdown(12, 99.99)).toEqual([]);
  });

  it("uses five to thirty photos per chapter", () => {
    expect(PHOTOS_PER_CHAPTER_TARGET).toEqual({ min: 5, max: 30 });
    expect(MIN_PHOTOS_FOR_BOOK).toBe(25);
    expect(maxSupportedChapters(25)).toBe(5);
    expect(maxSupportedChapters(29)).toBe(5);
    expect(maxSupportedChapters(30)).toBe(6);
  });
});

describe("the pages a book orders", () => {
  it("orders the book that was made, not a fixed ten pages a chapter", () => {
    // A five-chapter book of thirty-four pages orders thirty-four.
    expect(orderedInteriorPages(34, 5)).toBe(34);
    // An odd length rounds up: a leaf has two sides.
    expect(orderedInteriorPages(35, 5)).toBe(36);
  });

  it("never orders more than the chapters that were paid for", () => {
    expect(orderedInteriorPages(200, 5)).toBe(luluInteriorPages(5));
  });

  it("pads a very short book up to what the printer will bind", () => {
    expect(orderedInteriorPages(12, 5)).toBe(MIN_PRINTABLE_INTERIOR_PAGES);
    expect(orderedInteriorPages(MIN_PRINTABLE_INTERIOR_PAGES, 5)).toBe(
      MIN_PRINTABLE_INTERIOR_PAGES,
    );
  });
});
