import { describe, expect, it } from "vitest";

import { chaptersForBankedBook } from "@/lib/drafts/banked-chapters";
import {
  BASE_CHAPTERS,
  FIXED_INTERIOR_PAGES,
  MAX_CHAPTERS,
  MAX_STORY_PAGES_PER_CHAPTER,
} from "@/lib/pricing";

/** A file with a cover, the fixed pages, and this many story pages. */
const file = (storyPages: number) => 1 + FIXED_INTERIOR_PAGES + storyPages;

describe("the chapters a banked book is priced at", () => {
  it("is never fewer than the shortest book", () => {
    expect(chaptersForBankedBook(file(12), undefined)).toBe(BASE_CHAPTERS);
    expect(chaptersForBankedBook(file(12), BASE_CHAPTERS)).toBe(BASE_CHAPTERS);
    expect(chaptersForBankedBook(1, undefined)).toBe(BASE_CHAPTERS);
  });

  it("takes the declared count when the pages allow it", () => {
    // Chapters can run short, so a long count over few pages is honest.
    expect(chaptersForBankedBook(file(40), 12)).toBe(12);
  });

  it("lets the pages put a floor under an understated count", () => {
    const pages = file(30 * MAX_STORY_PAGES_PER_CHAPTER);
    expect(chaptersForBankedBook(pages, BASE_CHAPTERS)).toBe(30);
    expect(chaptersForBankedBook(pages, undefined)).toBe(30);
  });

  it("rounds a part chapter up", () => {
    const pages = file(6 * MAX_STORY_PAGES_PER_CHAPTER + 1);
    expect(chaptersForBankedBook(pages, BASE_CHAPTERS)).toBe(7);
  });

  it("does not count the cover or the fixed pages as story", () => {
    const pages = file(BASE_CHAPTERS * MAX_STORY_PAGES_PER_CHAPTER);
    expect(chaptersForBankedBook(pages, undefined)).toBe(BASE_CHAPTERS);
  });

  it("never goes past the longest book", () => {
    expect(chaptersForBankedBook(file(5000), undefined)).toBe(MAX_CHAPTERS);
    expect(chaptersForBankedBook(file(10), MAX_CHAPTERS + 20)).toBe(MAX_CHAPTERS);
  });
});
