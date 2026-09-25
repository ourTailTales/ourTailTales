import {
  MAX_NOTES_PER_PAGE,
  MAX_PHOTOS_PER_PAGE,
  NOTE_PAGE,
  assignToSlots,
  chooseLayout,
  isPhotoLayout,
  layoutNoteCount,
  layoutPhotoCount,
  seededUnit,
} from "@/lib/book/layouts";
import { STORY_PAGES_PER_CHAPTER } from "@/lib/pricing";
import type { BookMeta, BookPage, Chapter, LayoutId, PhotoLayoutId } from "@/types/book";
import type { Orientation } from "@/types/photo";

/** The opener is one of the chapter's 10 story pages. */
export const PHOTO_PAGES_PER_CHAPTER = STORY_PAGES_PER_CHAPTER - 1;

/**
 * Photos a page takes when the book decides. Pages the customer chose a
 * layout for can hold up to `MAX_PHOTOS_PER_PAGE`; left to itself the book
 * stays a little calmer than that.
 */
const AUTO_MAX_PHOTOS_PER_PAGE = 4;

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

  // Carried across chapters, not reset with each one: a book whose every
  // chapter opens with the same three layouts is the same template twice.
  const recent: LayoutId[] = [];
  let photoPages = 0;

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
    const chosen = chapterPageLayouts(chapter);
    const notes = chapterPageNotes(chapter);
    const { counts } = planChapterPages(body.length, chosen, chapter.id);
    // A chapter with fewer photographs than pages leans on its words: every
    // page that does have a photograph keeps room to say something about it.
    const sparse = body.length < PHOTO_PAGES_PER_CHAPTER;

    for (let index = 0; index < PHOTO_PAGES_PER_CHAPTER; index += 1) {
      const slice = body.splice(0, counts[index]!);
      const wanted = chosen[index];
      const pageId = `page-${chapter.id}-${index}`;

      const layoutId: PhotoLayoutId =
        slice.length === 0
          ? // Never a blank sheet of paper: a page the chapter has no
            // photograph for becomes a page for words.
            NOTE_PAGE
          : wanted && layoutPhotoCount(wanted) === slice.length
            ? wanted
            : chooseLayout(
                slice.map((id) => orientations.get(id) ?? "landscape"),
                {
                  recent,
                  seed: pageId,
                  wantsWords: sparse ? true : wantsWords(photoPages),
                },
              );

      if (slice.length > 0) {
        recent.push(layoutId);
        if (recent.length > RECENT_MEMORY) recent.shift();
        photoPages += 1;
      }

      const ordered =
        slice.length > 1
          ? assignToSlots(
              layoutId,
              slice.map((id) => ({
                id,
                orientation: orientations.get(id) ?? "landscape",
              })),
            )
          : slice;

      const pageNotes = notesForPage(notes[index], layoutNoteCount(layoutId));

      push({
        id: pageId,
        kind: "photos",
        layoutId,
        photoIds: ordered,
        chapterId: chapter.id,
        chapterIndex: chapter.index,
        chapterPageIndex: index,
        ...(pageNotes ? { notes: pageNotes } : {}),
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
 * How many photos the next page takes.
 *
 * Deliberately not an even spread. Dealing the same three photographs onto
 * every page gives a chapter one layout repeated nine times, which is what
 * made the preview look machine-made; this varies the count by one either
 * way, seeded by the page so a book always deals itself the same way.
 *
 * The bounds are what keep it honest: never so many that the pages after it
 * cannot be filled, never so few that the chapter runs out of pages before it
 * runs out of photographs. Photos are never repeated to fill space — a sparse
 * chapter simply gets larger images.
 */
function photosForPage(remaining: number, pagesLeft: number, seed: string): number {
  if (remaining <= 0 || pagesLeft <= 0) return 0;
  const even = remaining / pagesLeft;
  const cap =
    Math.ceil(even) > AUTO_MAX_PHOTOS_PER_PAGE ? MAX_PHOTOS_PER_PAGE : AUTO_MAX_PHOTOS_PER_PAGE;

  // Enough that what is left still fits on the pages that are left, and few
  // enough that each of those pages can still have one.
  const floor = Math.max(1, remaining - (pagesLeft - 1) * cap);
  const ceiling = Math.min(cap, remaining - (pagesLeft - 1));
  // No room to vary: the chapter is as full as its pages can hold.
  if (ceiling <= floor) return Math.max(1, Math.min(floor, cap, remaining));

  // Roughly one page in seven is given a single photograph, whatever the
  // chapter's average — a picture the size of the page is the best thing a
  // photo book does, and an even spread never produces one.
  const roll = seededUnit(seed);
  const wanted =
    roll < 0.14 ? 1 : Math.round(even) + (roll < 0.44 ? -1 : roll < 0.74 ? 1 : 0);
  return Math.min(Math.max(wanted, floor), ceiling);
}

/** Pages the book means to give room for words: about one in three. */
function wantsWords(photoPagesSoFar: number): boolean {
  return photoPagesSoFar % 3 === 1;
}

/** How many layout choices back the book remembers when reaching for variety. */
const RECENT_MEMORY = 8;

/** The most a note can run to. Longer than this stops being a caption. */
export const MAX_NOTE_LENGTH = 220;

/** A chapter's chosen layouts, one entry per photo page, unknown ids dropped. */
export function chapterPageLayouts(chapter: Pick<Chapter, "pageLayouts">): (PhotoLayoutId | null)[] {
  return Array.from({ length: PHOTO_PAGES_PER_CHAPTER }, (_, index) => {
    const id = chapter.pageLayouts?.[index];
    return isPhotoLayout(id) ? id : null;
  });
}

/** A chapter's written notes, one entry per photo page. */
export function chapterPageNotes(
  chapter: Pick<Chapter, "pageNotes">,
): ((string | null)[] | null)[] {
  return Array.from({ length: PHOTO_PAGES_PER_CHAPTER }, (_, index) => {
    const entry = chapter.pageNotes?.[index];
    return Array.isArray(entry) ? entry.slice(0, MAX_NOTES_PER_PAGE) : null;
  });
}

/**
 * The notes a page carries, trimmed to what its layout has room for. Returns
 * null when the owner has written nothing — the design then falls back to
 * what the book already knows about the page rather than printing a blank.
 */
function notesForPage(
  written: (string | null)[] | null,
  slots: number,
): (string | null)[] | null {
  if (slots === 0 || !written) return null;
  const notes = Array.from({ length: slots }, (_, index) => {
    const text = written[index];
    return typeof text === "string" && text.trim() ? text.trim() : null;
  });
  return notes.some((note) => note !== null) ? notes : null;
}

/** One of a chapter's pages gains, changes or loses a written note. */
export function applyPageNote(
  chapter: Chapter,
  pageIndex: number,
  slot: number,
  text: string,
): Chapter {
  if (pageIndex < 0 || pageIndex >= PHOTO_PAGES_PER_CHAPTER) return chapter;
  if (slot < 0 || slot >= MAX_NOTES_PER_PAGE) return chapter;

  const pages = chapterPageNotes(chapter);
  const page = [...(pages[pageIndex] ?? [])];
  while (page.length <= slot) page.push(null);
  page[slot] = text.trim() ? text.slice(0, MAX_NOTE_LENGTH) : null;
  pages[pageIndex] = page.some((note) => note && note.trim()) ? page : null;

  // Trailing empties carry no information, and an all-empty list is no list.
  while (pages.length > 0 && pages.at(-1) === null) pages.pop();

  return { ...chapter, pageNotes: pages.length > 0 ? pages : undefined };
}

/**
 * How many photos each of a chapter's photo pages takes, in order.
 *
 * A page the customer chose a layout for takes exactly what that layout
 * holds, as long as the chapter has the photos. The rest of the chapter's
 * photos are spread over the other pages, leaving enough in reserve for any
 * chosen layout still to come. `leftover` counts photos no page had room for.
 */
export function planChapterPages(
  total: number,
  chosen: readonly (PhotoLayoutId | null)[],
  seed = "",
): { counts: number[]; leftover: number } {
  const counts: number[] = [];
  let remaining = total;
  for (let index = 0; index < PHOTO_PAGES_PER_CHAPTER; index += 1) {
    const wanted = chosen[index];
    if (wanted) {
      const take = Math.min(layoutPhotoCount(wanted), remaining);
      counts.push(take);
      remaining -= take;
      continue;
    }
    let reserved = 0;
    let freePages = 0;
    for (let later = index; later < PHOTO_PAGES_PER_CHAPTER; later += 1) {
      const laterWanted = chosen[later];
      if (laterWanted) {
        if (later > index) reserved += layoutPhotoCount(laterWanted);
      } else {
        freePages += 1;
      }
    }
    const take = photosForPage(Math.max(0, remaining - reserved), freePages, `${seed}:${index}`);
    counts.push(take);
    remaining -= take;
  }
  return { counts, leftover: remaining };
}

/**
 * Which of its chapter's photo pages a page is. Pages saved before the index
 * was stored carry it only in their id, `page-<chapter>-<index>`.
 */
export function photoPageIndex(page: BookPage): number | null {
  if (page.kind !== "photos") return null;
  if (page.chapterPageIndex !== undefined) return page.chapterPageIndex;
  const match = /-(\d+)$/.exec(page.id);
  return match ? Number(match[1]) : null;
}

/** Photos from the chapter's date range that are not in the book, in album order. */
export function sparePhotos(chapter: Pick<Chapter, "candidateIds" | "photoIds">): string[] {
  const used = new Set(chapter.photoIds);
  return chapter.candidateIds.filter((id) => !used.has(id));
}

/**
 * The chapter's unused photos taken closest in time to a page's own, so a
 * page that grows gains photos from the same afternoon rather than from the
 * start of the chapter. `candidateIds` is in album order; a page with no
 * photos yet is placed by how far through the chapter it falls.
 */
function nearestSpares(
  chapter: Chapter,
  onPage: string[],
  pageIndex: number,
  count: number,
): string[] {
  const order = new Map(chapter.candidateIds.map((id, index) => [id, index]));
  const positions = onPage.map((id) => order.get(id)).filter((at): at is number => at !== undefined);
  const centre =
    positions.length > 0
      ? positions.reduce((sum, at) => sum + at, 0) / positions.length
      : ((pageIndex + 0.5) / PHOTO_PAGES_PER_CHAPTER) * chapter.candidateIds.length;
  return sparePhotos(chapter)
    .map((id) => ({ id, distance: Math.abs(order.get(id)! - centre) }))
    .sort((a, b) => a.distance - b.distance)
    .slice(0, count)
    .sort((a, b) => order.get(a.id)! - order.get(b.id)!)
    .map((entry) => entry.id);
}

/**
 * The most photos one of a chapter's pages could be given: everything the
 * chapter has, plus its spares, less what the other chosen layouts claim.
 */
export function maxPhotosForPage(chapter: Chapter, pageIndex: number): number {
  const hero = chapter.heroPhotoId ?? chapter.photoIds[0] ?? null;
  const body = chapter.photoIds.filter((id) => id !== hero).length;
  const claimed = chapterPageLayouts(chapter).reduce(
    (sum, id, index) => (id && index !== pageIndex ? sum + layoutPhotoCount(id) : sum),
    0,
  );
  return Math.max(0, body + sparePhotos(chapter).length - claimed);
}

/**
 * Gives one of a chapter's photo pages a layout (or hands it back to the
 * book, with `null`), and makes the chapter's photos fit.
 *
 * A layout with room for more photos than the page has takes them from the
 * chapter's unused photos first, placed on this page, so the other pages keep
 * theirs; only once those run out does it draw on photos from later pages.
 * A layout with fewer lets the extras flow onto the following pages, and if
 * every page is spoken for, the extras go back to the chapter's unused photos
 * rather than disappearing.
 */
export function applyPageLayout(
  chapter: Chapter,
  pageIndex: number,
  layoutId: PhotoLayoutId | null,
): Chapter {
  if (pageIndex < 0 || pageIndex >= PHOTO_PAGES_PER_CHAPTER) return chapter;
  const hero = chapter.heroPhotoId ?? chapter.photoIds[0] ?? null;
  const before = chapterPageLayouts(chapter);
  const chosen = [...before];
  chosen[pageIndex] = layoutId;

  const body = chapter.photoIds.filter((id) => id !== hero);
  const { counts } = planChapterPages(body.length, before);
  const start = counts.slice(0, pageIndex).reduce((sum, count) => sum + count, 0);
  const current = counts[pageIndex] ?? 0;

  if (layoutId) {
    const need = layoutPhotoCount(layoutId) - current;
    if (need > 0) {
      const spares = nearestSpares(chapter, body.slice(start, start + current), pageIndex, need)
        .filter((id) => id !== hero);
      body.splice(start + current, 0, ...spares);
    }
  }

  const plan = planChapterPages(body.length, chosen);
  const photoIds = plan.leftover > 0 ? body.slice(0, body.length - plan.leftover) : body;
  const heroAt = hero ? chapter.photoIds.indexOf(hero) : -1;
  if (hero && heroAt !== -1) photoIds.splice(Math.min(heroAt, photoIds.length), 0, hero);

  // Trailing "let the book decide" entries carry no information.
  while (chosen.length > 0 && chosen.at(-1) === null) chosen.pop();

  return {
    ...chapter,
    photoIds,
    pageLayouts: chosen.length > 0 ? chosen : undefined,
  };
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

/** The title page's heading: "For Biscuit". */
export function titlePageHeading(petName: string): string {
  const name = petName.trim();
  return name ? `For ${name}` : "Their Story";
}
