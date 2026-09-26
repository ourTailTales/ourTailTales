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
  chaptersForSpan,
  chaptersForTier,
  photosForTier,
  recommendedTier,
  tierIsAvailable,
  luluInteriorPages,
  maxSupportedChapters,
  orderedInteriorPages,
  priceBreakdown,
  storedPriceBreakdown,
  storyPages,
  tierForChapterCount,
} from "@/lib/pricing";

describe("book pricing", () => {
  it("covers the first five chapters with the base price", () => {
    expect(BASE_CHAPTERS).toBe(5);
    expect(BASE_PRICE).toBe(49.99);
    expect(storyPages(5)).toBe(50);
    expect(luluInteriorPages(5)).toBe(54);
    expect(bookPrice(5)).toBe(BASE_PRICE);
    // Nothing shorter is sold, so nothing shorter is cheaper.
    expect(bookPrice(1)).toBe(BASE_PRICE);
    expect(CHAPTER_TIERS[0]!.ratePerChapter).toBe(0);
  });

  it("charges each chapter past the fifth at its own band's rate", () => {
    // Twelve is the last Chronicle chapter; only the thirteenth and beyond
    // are charged at the Archive rate.
    expect(bookPrice(6)).toBe(54.98);
    expect(bookPrice(12)).toBe(84.92);
    expect(bookPrice(13)).toBe(88.91);
    expect(bookPrice(MAX_CHAPTERS)).toBe(236.54);
  });

  it("quotes every rate in whole dollars and ninety-nine cents", () => {
    expect(BASE_PRICE % 1).toBeCloseTo(0.99, 2);
    for (const tier of CHAPTER_TIERS) {
      if (tier.ratePerChapter === 0) continue;
      expect(tier.ratePerChapter % 1).toBeCloseTo(0.99, 2);
    }
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
    expect(CHAPTER_TIERS[0]!.toChapter).toBe(BASE_CHAPTERS);
    expect(CHAPTER_TIERS.at(-1)!.toChapter).toBe(MAX_CHAPTERS);
    for (const [index, tier] of CHAPTER_TIERS.slice(1).entries()) {
      expect(tier.fromChapter).toBe(CHAPTER_TIERS[index]!.toChapter + 1);
      // Longer books never cost more per chapter, the free first band aside.
      if (index > 0) {
        expect(tier.ratePerChapter).toBeLessThan(CHAPTER_TIERS[index]!.ratePerChapter);
      }
    }
  });

  it("breaks a price into the bands that made it", () => {
    const lines = priceBreakdown(15);
    expect(lines.map((line) => [line.tier.id, line.chapters, line.subtotal])).toEqual([
      ["keepsake", 5, BASE_PRICE],
      ["chronicle", 7, 34.93],
      ["archive", 3, 11.97],
    ]);
    expect(lines.reduce((total, line) => total + line.subtotal, 0)).toBeCloseTo(
      bookPrice(15),
      2,
    );
    // The base price is shown against the chapters it covers, not as a rate.
    expect(lines[0]!.includedInBase).toBe(true);
    expect(lines[1]!.includedInBase).toBe(false);
    // Bands the book never reaches are not printed on the invoice.
    expect(priceBreakdown(BASE_CHAPTERS)).toHaveLength(1);
  });

  it("names the band a book's last chapter falls in", () => {
    expect(tierForChapterCount(BASE_CHAPTERS).id).toBe("keepsake");
    expect(tierForChapterCount(6).id).toBe("chronicle");
    expect(tierForChapterCount(12).id).toBe("chronicle");
    expect(tierForChapterCount(13).id).toBe("archive");
    expect(tierForChapterCount(MAX_CHAPTERS).id).toBe("archive");
  });

  it("will not explain an old total with today's rates", () => {
    expect(storedPriceBreakdown(15, bookPrice(15))).toHaveLength(3);
    // A price from before a rate change: the receipt shows the total alone.
    expect(storedPriceBreakdown(15, 999.99)).toEqual([]);
  });
});

describe("how long a book the album wants to be", () => {
  const year = 365.2425 * 24 * 60 * 60 * 1000;
  const span = (years: number) => ({ firstAt: 0, lastAt: years * year });
  // Enough photographs that the album never limits the answer.
  const plenty = MAX_CHAPTERS * PHOTOS_PER_CHAPTER_TARGET.min;

  it("gives a chapter to each year between the first photo and the last", () => {
    expect(chaptersForSpan(0, 8 * year)).toBe(8);
    expect(chaptersForSpan(0, 14 * year)).toBe(14);
  });

  it("never proposes a book shorter or longer than we make", () => {
    expect(chaptersForSpan(0, 0)).toBe(BASE_CHAPTERS);
    expect(chaptersForSpan(0, 2 * year)).toBe(BASE_CHAPTERS);
    expect(chaptersForSpan(0, 90 * year)).toBe(MAX_CHAPTERS);
    // An album whose photographs carry no dates at all.
    expect(chaptersForSpan(null, null)).toBe(BASE_CHAPTERS);
  });

  it("recommends the band that span falls in", () => {
    expect(recommendedTier({ ...span(1), usablePhotoCount: plenty }).id).toBe("keepsake");
    expect(recommendedTier({ ...span(8), usablePhotoCount: plenty }).id).toBe("chronicle");
    expect(recommendedTier({ ...span(16), usablePhotoCount: plenty }).id).toBe("archive");
  });

  it("will not recommend a book the album cannot fill", () => {
    // Sixteen years of photographs, but only thirty of them.
    expect(recommendedTier({ ...span(16), usablePhotoCount: 30 }).id).toBe("chronicle");
    expect(recommendedTier({ ...span(16), usablePhotoCount: 25 }).id).toBe("keepsake");
  });

  it("offers a band only once the album can fill its shortest book", () => {
    const [keepsake, chronicle, archive] = CHAPTER_TIERS;
    expect(tierIsAvailable(keepsake!, MIN_PHOTOS_FOR_BOOK)).toBe(true);
    expect(tierIsAvailable(chronicle!, MIN_PHOTOS_FOR_BOOK)).toBe(false);
    expect(tierIsAvailable(chronicle!, photosForTier(chronicle!))).toBe(true);
    expect(tierIsAvailable(archive!, photosForTier(archive!) - 5)).toBe(false);
    expect(tierIsAvailable(archive!, photosForTier(archive!))).toBe(true);
  });

  it("fits the wanted length to the band picked and the photos on hand", () => {
    const [keepsake, chronicle, archive] = CHAPTER_TIERS;
    // An eight-year album: Chronicle gives it the eight it asked for.
    expect(
      chaptersForTier(chronicle!, { wantedChapters: 8, usablePhotoCount: plenty }),
    ).toBe(8);
    // The same album held to Keepsake, or stretched to Archive.
    expect(
      chaptersForTier(keepsake!, { wantedChapters: 8, usablePhotoCount: plenty }),
    ).toBe(BASE_CHAPTERS);
    expect(
      chaptersForTier(archive!, { wantedChapters: 8, usablePhotoCount: plenty }),
    ).toBe(archive!.fromChapter);
    // Never more chapters than the photographs can fill.
    expect(
      chaptersForTier(chronicle!, { wantedChapters: 12, usablePhotoCount: 40 }),
    ).toBe(8);
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
