import { describe, expect, it } from "vitest";

import {
  BASE_CHAPTERS,
  BASE_PRICE,
  MIN_PHOTOS_FOR_BOOK,
  MIN_PRINTABLE_INTERIOR_PAGES,
  PHOTOS_PER_CHAPTER_TARGET,
  bookPrice,
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
