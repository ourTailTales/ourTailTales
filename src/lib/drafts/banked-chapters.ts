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

const sameName = (a: string | null | undefined, b: string | null | undefined) =>
  (a ?? "").trim().toLowerCase() === (b ?? "").trim().toLowerCase();

/**
 * Whether a book may be saved onto a draft that has already been paid for.
 *
 * A paid draft is the buyer's copy of one book. Saving it again after fixing
 * a caption is the same book and is allowed. A book for a different pet, or
 * one longer than the book that was paid for, is a different purchase: it
 * goes to a draft of its own, so the paid file is not replaced and the new
 * book is not unlocked for nothing.
 *
 * `chapters` is null for a teaser, whose length says nothing about its book.
 * A paid draft with no recorded name or length cannot be compared on that
 * point and is not refused on it.
 */
export function mayRebankPurchasedDraft(args: {
  purchasedPetName: string | null | undefined;
  purchasedChapters: number | null | undefined;
  petName: string | null | undefined;
  chapters: number | null;
}): boolean {
  const named = (args.purchasedPetName ?? "").trim().length > 0;
  if (named && !sameName(args.purchasedPetName, args.petName)) return false;
  if (
    args.chapters !== null &&
    typeof args.purchasedChapters === "number" &&
    args.chapters > args.purchasedChapters
  ) {
    return false;
  }
  return true;
}
