import { describe, expect, it } from "vitest";

import {
  MAX_PHOTOS_PER_PAGE,
  layoutForCount,
  layoutNoteCount,
  layoutPhotoCount,
  maxPhotosOnPage,
} from "@/lib/book/layouts";

describe("how much one page holds", () => {
  it("takes six photographs alone, and four once it has words on it", () => {
    expect(maxPhotosOnPage(false)).toBe(MAX_PHOTOS_PER_PAGE);
    expect(maxPhotosOnPage(false)).toBe(6);
    expect(maxPhotosOnPage(true)).toBe(4);
  });
});

describe("a layout for this many photographs", () => {
  it("keeps the page's mind about words", () => {
    const plain = layoutForCount(3, false);
    const worded = layoutForCount(3, true);
    expect(plain).not.toBeNull();
    expect(worded).not.toBeNull();
    expect(layoutPhotoCount(plain!)).toBe(3);
    expect(layoutPhotoCount(worded!)).toBe(3);
    expect(layoutNoteCount(plain!)).toBe(0);
    expect(layoutNoteCount(worded!)).toBeGreaterThan(0);
  });

  it("gives up the words rather than the photographs past four", () => {
    // Five photographs and a caption is not a page this book offers, so the
    // fifth photograph wins and the page loses its line.
    const five = layoutForCount(5, true);
    expect(five).not.toBeNull();
    expect(layoutPhotoCount(five!)).toBe(5);
    expect(layoutNoteCount(five!)).toBe(0);
  });

  it("has nothing for a page of seven", () => {
    expect(layoutForCount(MAX_PHOTOS_PER_PAGE + 1, false)).toBeNull();
    expect(layoutForCount(0, false)).toBeNull();
  });
});
