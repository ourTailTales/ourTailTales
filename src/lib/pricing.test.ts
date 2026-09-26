import { describe, expect, it } from "vitest";

import {
  BASE_CHAPTERS,
  BASE_PRICE,
  FIXED_INTERIOR_PAGES,
  MAX_CHAPTERS,
  MIN_PHOTOS_FOR_BOOK,
  MIN_PRINTABLE_INTERIOR_PAGES,
  PHOTOS_PER_CHAPTER_TARGET,
  PRICE_PER_EXTRA_CHAPTER,
  bookPrice,
  bookTier,
  chapterRateSummary,
  nextChapterPrice,
  luluInteriorPages,
  maxSupportedChapters,
  orderedInteriorPages,
  storyPages,
} from "@/lib/pricing";

describe("book pricing", () => {
  it("prices the five-chapter base book at $49.99", () => {
    expect(BASE_CHAPTERS).toBe(5);
    expect(BASE_PRICE).toBe(49.99);
    expect(storyPages(5)).toBe(50);
    expect(luluInteriorPages(5)).toBe(54);
    expect(bookPrice(5)).toBe(49.99);
  });

  it("adds $4.99 for each additional 10-page chapter", () => {
    expect(storyPages(6)).toBe(60);
    expect(luluInteriorPages(6)).toBe(64);
    expect(bookPrice(6)).toBe(54.98);
    expect(bookPrice(8)).toBe(64.96);
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

describe("what a book of this length is called", () => {
  it("names each tier at its boundaries", () => {
    expect(bookTier(1).label).toBe("Keepsake");
    expect(bookTier(BASE_CHAPTERS).label).toBe("Keepsake");
    expect(bookTier(BASE_CHAPTERS + 1).label).toBe("Story");
    expect(bookTier(15).label).toBe("Story");
    expect(bookTier(16).label).toBe("Family Saga");
    expect(bookTier(30).label).toBe("Family Saga");
    expect(bookTier(31).label).toBe("Complete Life Story");
    expect(bookTier(MAX_CHAPTERS).label).toBe("Complete Life Story");
  });

  it("has a name for a book past the printer's cap rather than none", () => {
    expect(bookTier(MAX_CHAPTERS + 10).label).toBe("Complete Life Story");
  });

  it("names the tier whose rate the next chapter is charged at", () => {
    expect(nextChapterPrice(BASE_CHAPTERS)).toBe(PRICE_PER_EXTRA_CHAPTER);
    expect(nextChapterPrice(15)).toBe(4.49);
    expect(nextChapterPrice(30)).toBe(4.29);
  });
});

describe("what each chapter costs", () => {
  it("charges the base book for the first five", () => {
    expect(bookPrice(1)).toBe(BASE_PRICE);
    expect(bookPrice(BASE_CHAPTERS)).toBe(BASE_PRICE);
  });

  it("eases the rate off with length", () => {
    // Six to fifteen at $4.99, sixteen to thirty at $4.49, the rest at $4.29.
    expect(bookPrice(15)).toBe(99.89);
    expect(bookPrice(30)).toBe(167.24);
    expect(bookPrice(MAX_CHAPTERS)).toBe(253.04);
  });

  it("never reprices a chapter because a later one was added", () => {
    // The thirty-first chapter costs $4.29; it does not move the thirty
    // before it onto that rate.
    expect(bookPrice(31) - bookPrice(30)).toBeCloseTo(4.29, 2);
    expect(bookPrice(16) - bookPrice(15)).toBeCloseTo(4.49, 2);
  });

  it("always costs more for more, however the rates are set", () => {
    for (let chapters = BASE_CHAPTERS; chapters < MAX_CHAPTERS; chapters += 1) {
      expect(bookPrice(chapters + 1)).toBeGreaterThan(bookPrice(chapters));
    }
  });

  it("describes its own rates rather than repeating them in copy", () => {
    expect(chapterRateSummary()).toBe("$4.99 each to 15, then $4.49 each to 30, then $4.29 beyond 30");
  });
});

describe("the floor these rates were set against", () => {
  /**
   * Lulu's print cost, from the four quotes in the pricing review: $2.148 a
   * chapter marginal, $11.84 fixed, which reproduces all four to the cent.
   * Here rather than in the app because it is an input to a decision, not
   * something the app computes with — but it belongs in the tests, because
   * it is what stops a future edit from quietly pricing below cost.
   */
  const printCost = (chapters: number) => 11.84 + 2.148 * chapters;
  const FLOOR = 0.51;

  it("keeps every book above a 51% print margin", () => {
    for (let chapters = BASE_CHAPTERS; chapters <= MAX_CHAPTERS; chapters += 1) {
      const price = bookPrice(chapters);
      const margin = (price - printCost(chapters)) / price;
      expect(margin, `${chapters} chapters`).toBeGreaterThan(FLOOR);
    }
  });

  it("holds at the longest book, which is where it binds", () => {
    const price = bookPrice(MAX_CHAPTERS);
    const margin = (price - printCost(MAX_CHAPTERS)) / price;
    expect(margin).toBeGreaterThan(0.52);
    // The rates first proposed — $3.99 and $2.99 — would have been 45.7%.
    expect(margin).toBeLessThan(0.57);
  });
});

describe("the estimate shown before a word is written", () => {
  it("quotes the same price and pages the finished book is charged at", () => {
    // The screen renders these two functions and nothing of its own, so this
    // is the estimate: what it promises is what `prepareOrder` later writes
    // onto the order row.
    for (const [chapters, price] of [
      [5, 49.99],
      [6, 54.98],
      [12, 84.92],
      [15, 99.89],
      [30, 167.24],
      [50, 253.04],
    ] as const) {
      expect(bookPrice(chapters)).toBe(price);
      expect(luluInteriorPages(chapters)).toBe(chapters * 10 + FIXED_INTERIOR_PAGES);
    }
  });

  it("moves by the next chapter's own rate at each step of the stepper", () => {
    let last = bookPrice(BASE_CHAPTERS);
    for (let chapters = BASE_CHAPTERS + 1; chapters <= MAX_CHAPTERS; chapters += 1) {
      const next = bookPrice(chapters);
      expect(next - last).toBeCloseTo(nextChapterPrice(chapters - 1), 2);
      last = next;
    }
  });
});
