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
  TOP_TIER_DISCOUNT_PER_CHAPTER,
  TOP_TIER_FROM_CHAPTER,
  bookPrice,
  bookTier,
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

  it("is a name and nothing else — the price does not step at a boundary", () => {
    for (const at of [BASE_CHAPTERS, 15, 30]) {
      expect(bookPrice(at + 1) - bookPrice(at)).toBeCloseTo(
        PRICE_PER_EXTRA_CHAPTER - TOP_TIER_DISCOUNT_PER_CHAPTER * (at >= 30 ? 1 : 0),
        2,
      );
    }
  });
});

describe("the long-book discount", () => {
  it("is off, so every chapter past the base is the same price", () => {
    expect(TOP_TIER_DISCOUNT_PER_CHAPTER).toBe(0);
    expect(bookPrice(MAX_CHAPTERS)).toBeCloseTo(
      BASE_PRICE + (MAX_CHAPTERS - BASE_CHAPTERS) * PRICE_PER_EXTRA_CHAPTER,
      2,
    );
  });

  it("would only ever touch the chapters past its threshold", () => {
    // The shape a future discount takes, checked without turning one on: a
    // book at the threshold is unaffected however the constant is set.
    expect(TOP_TIER_FROM_CHAPTER).toBe(30);
    expect(bookPrice(TOP_TIER_FROM_CHAPTER)).toBeCloseTo(
      BASE_PRICE + (TOP_TIER_FROM_CHAPTER - BASE_CHAPTERS) * PRICE_PER_EXTRA_CHAPTER,
      2,
    );
  });
});

describe("the estimate shown before a word is written", () => {
  it("quotes the same price and pages the finished book is charged at", () => {
    // The screen renders these two functions and nothing of its own, so this
    // is the estimate: what it promises is what `prepareOrder` later writes
    // onto the order row.
    for (const chapters of [5, 6, 12, 13, 30, 50]) {
      expect(bookPrice(chapters)).toBe(
        Math.round((BASE_PRICE + (chapters - BASE_CHAPTERS) * PRICE_PER_EXTRA_CHAPTER) * 100) /
          100,
      );
      expect(luluInteriorPages(chapters)).toBe(chapters * 10 + FIXED_INTERIOR_PAGES);
    }
  });

  it("moves by one chapter's price for each step of the stepper", () => {
    let last = bookPrice(BASE_CHAPTERS);
    for (let chapters = BASE_CHAPTERS + 1; chapters <= MAX_CHAPTERS; chapters += 1) {
      const next = bookPrice(chapters);
      expect(next).toBeGreaterThan(last);
      expect(next - last).toBeCloseTo(PRICE_PER_EXTRA_CHAPTER, 2);
      last = next;
    }
  });
});
