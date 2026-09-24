import type { BookPage, Chapter } from "@/types/book";

/**
 * The free book: the first ten pages, and nothing after them.
 *
 * The whole book is written before any of this runs — the customer's story
 * exists in full from the moment generation finishes. What the teaser decides
 * is only how much of it leaves without an account. Ten pages is enough to
 * read the opening of their pet's life and see the layout, binding, and cover
 * their photos produced; it is not enough to be finished with it.
 *
 * Counted in pages rather than chapters on purpose. A five-chapter book and a
 * fifty-chapter book then give away the same amount, and a customer with a
 * sparse album is not handed a third of their story while a customer with a
 * full one is handed a fiftieth.
 */

/** Pages in the free file, the front cover included. */
export const TEASER_PAGE_COUNT = 10;

/** Of those, how many are interior pages — the cover takes the first slot. */
export const TEASER_INTERIOR_PAGES = TEASER_PAGE_COUNT - 1;

/**
 * The largest a legitimate teaser PDF can actually be.
 *
 * `TEASER_PAGE_COUNT` is the free content: the cover plus nine interior
 * pages. Whenever the book keeps going past what the teaser shows — true for
 * every book down to the five-chapter minimum, since that alone is already
 * many times `TEASER_INTERIOR_PAGES` — the renderer appends one more page
 * saying so, a "there is more" notice rather than a customer-facing page.
 * That page is a normal, expected part of the file the browser uploads, so
 * the upload route has to accept it too; checking against
 * `TEASER_PAGE_COUNT` itself rejected almost every real teaser as if it were
 * the whole book smuggled through.
 */
export const TEASER_PDF_MAX_PAGES = TEASER_PAGE_COUNT + 1;

export type TeaserSummary = {
  /** Interior pages included, at most `TEASER_INTERIOR_PAGES`. */
  shownPages: number;
  /** Interior pages left out. */
  hiddenPages: number;
  /** Chapters at least partly visible. */
  shownChapters: number;
  /** Chapters not reached at all. */
  hiddenChapters: number;
  /** True when the book is short enough that the teaser is the whole of it. */
  complete: boolean;
};

/** The interior pages the free file carries, in book order. */
export function teaserPages(pages: BookPage[]): BookPage[] {
  return pages.slice(0, TEASER_INTERIOR_PAGES);
}

/** True for a page the customer cannot read without an account. */
export function isLockedPage(pageIndex: number): boolean {
  return pageIndex >= TEASER_INTERIOR_PAGES;
}

export function summarizeTeaser(
  pages: BookPage[],
  chapters: Chapter[],
): TeaserSummary {
  const shown = teaserPages(pages);
  const reached = new Set(
    shown
      .map((page) => page.chapterId)
      .filter((id): id is string => Boolean(id)),
  );

  const shownChapters = chapters.filter((chapter) =>
    reached.has(chapter.id),
  ).length;

  return {
    shownPages: shown.length,
    hiddenPages: Math.max(0, pages.length - shown.length),
    shownChapters,
    hiddenChapters: Math.max(0, chapters.length - shownChapters),
    complete: pages.length <= shown.length,
  };
}
