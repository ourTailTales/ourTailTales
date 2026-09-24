import { assignToSlots, chooseLayout } from "@/lib/book/layouts";
import { STORY_PAGES_PER_CHAPTER } from "@/lib/pricing";
import type { BookMeta, BookPage, Chapter, LayoutId } from "@/types/book";
import type { Orientation } from "@/types/photo";

/** The opener is one of the chapter's 10 story pages. */
const PHOTO_PAGES_PER_CHAPTER = STORY_PAGES_PER_CHAPTER - 1;

const MAX_PHOTOS_PER_PAGE = 4;

export type OrientationLookup = Map<string, Orientation>;

/**
 * Builds the complete interior page list:
 * title, dedication, then 10 pages per chapter, then closing and imprint.
 *
 * The dedication page only exists when there is a dedication — an empty page
 * with a rule on it read as something missing. Page count is therefore
 * `chapters * 10 + 4` with a dedication and one fewer without; the print file
 * pads back to the ordered count (`padToPageCount` in the interior renderer).
 */
export function paginateBook(
  meta: BookMeta,
  chapters: Chapter[],
  orientations: OrientationLookup = new Map(),
): BookPage[] {
  const pages: BookPage[] = [];
  let pageNumber = 1;

  const push = (page: Omit<BookPage, "pageNumber">): void => {
    pages.push({ ...page, pageNumber });
    pageNumber += 1;
  };

  const firstHero = chapters[0]?.heroPhotoId ?? null;
  const titlePhoto = meta.coverPhotoId ?? firstHero;

  push({
    id: "page-title",
    kind: "title",
    layoutId: null,
    photoIds: titlePhoto ? [titlePhoto] : [],
  });

  if (hasDedication(meta)) {
    push({
      id: "page-dedication",
      kind: "dedication",
      layoutId: null,
      photoIds: [],
    });
  }

  for (const chapter of chapters) {
    const hero = chapter.heroPhotoId ?? chapter.photoIds[0] ?? null;

    push({
      id: `page-opener-${chapter.id}`,
      kind: "chapter-opener",
      layoutId: "chapter-opener",
      photoIds: hero ? [hero] : [],
      chapterId: chapter.id,
      chapterIndex: chapter.index,
    });

    const body = chapter.photoIds.filter((id) => id !== hero);
    const recent: LayoutId[] = [];

    for (let index = 0; index < PHOTO_PAGES_PER_CHAPTER; index += 1) {
      const pagesLeft = PHOTO_PAGES_PER_CHAPTER - index;
      const perPage = photosForPage(body.length, pagesLeft);
      const slice = body.splice(0, perPage);

      const layoutId =
        slice.length > 0
          ? chooseLayout(
              slice.map((id) => orientations.get(id) ?? "landscape"),
              recent,
            )
          : null;

      if (layoutId) recent.push(layoutId);

      const ordered =
        layoutId && slice.length > 1
          ? assignToSlots(
              layoutId,
              slice.map((id) => ({
                id,
                orientation: orientations.get(id) ?? "landscape",
              })),
            )
          : slice;

      push({
        id: `page-${chapter.id}-${index}`,
        kind: "photos",
        layoutId,
        photoIds: ordered,
        chapterId: chapter.id,
        chapterIndex: chapter.index,
      });
    }
  }

  const closingPhoto =
    chapters.at(-1)?.photoIds.at(-1) ?? chapters.at(-1)?.heroPhotoId ?? null;

  push({
    id: "page-closing",
    kind: "closing",
    layoutId: null,
    photoIds: closingPhoto ? [closingPhoto] : [],
  });

  push({
    id: "page-imprint",
    kind: "imprint",
    layoutId: null,
    photoIds: [],
  });

  return pages;
}

/**
 * Spreads the remaining photos across the remaining pages. Never repeats a
 * photo to fill space: a sparse chapter simply gets larger images.
 */
function photosForPage(remaining: number, pagesLeft: number): number {
  if (remaining <= 0) return 0;
  const even = Math.round(remaining / pagesLeft);
  return Math.min(Math.max(even, 1), MAX_PHOTOS_PER_PAGE, remaining);
}

export const CLOSING_LINE = "Always part of the story.";

/** "Biscuit" -> "Biscuit's", "Gus" -> "Gus'", unnamed -> "their". */
export function possessivePetName(petName: string): string {
  const name = petName.trim();
  if (!name) return "their";
  return /s$/i.test(name) ? `${name}'` : `${name}'s`;
}

/** Whether the book carries a dedication page. */
export function hasDedication(meta: Pick<BookMeta, "dedication">): boolean {
  return meta.dedication.trim().length > 0;
}

/**
 * Brings a saved page list in line with its dedication: drops a dedication
 * page whose text is gone. Books saved before an empty dedication stopped
 * getting a page still carry one, and re-paginating them from scratch would
 * throw away every layout the customer picked.
 */
export function withoutEmptyDedication(
  pages: BookPage[],
  meta: Pick<BookMeta, "dedication">,
): BookPage[] {
  if (hasDedication(meta) || !pages.some((page) => page.kind === "dedication")) {
    return pages;
  }
  return pages
    .filter((page) => page.kind !== "dedication")
    .map((page, index) => ({ ...page, pageNumber: index + 1 }));
}
