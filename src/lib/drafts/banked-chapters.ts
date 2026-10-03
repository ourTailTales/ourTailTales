import {
  BASE_CHAPTERS,
  FIXED_INTERIOR_PAGES,
  MAX_CHAPTERS,
  MAX_STORY_PAGES_PER_CHAPTER,
} from "@/lib/pricing";

/**
 * The chapter count a banked whole book is priced at.
 *
 * The browser says how many chapters it has, and the file says how many pages.
 * A chapter runs to `MAX_STORY_PAGES_PER_CHAPTER` pages at most, so the pages
 * put a floor under the chapters: leaving the count out, or understating it,
 * used to price a fifty-chapter book as a five-chapter one.
 */
export function chaptersForBankedBook(
  pages: number,
  declared: number | undefined,
): number {
  // One page is the cover; the fixed pages are not chapters either.
  const storyPages = Math.max(0, pages - 1 - FIXED_INTERIOR_PAGES);
  const needed = Math.ceil(storyPages / MAX_STORY_PAGES_PER_CHAPTER);
  const count = Math.max(declared ?? BASE_CHAPTERS, needed, BASE_CHAPTERS);
  return Math.min(count, MAX_CHAPTERS);
}
