import {
  MAX_NOTES_PER_PAGE,
  assignToSlots,
  chooseLayout,
  isPhotoLayout,
  layoutForCount,
  layoutNoteCount,
  layoutPhotoCount,
  maxPhotosOnPage,
} from "@/lib/book/layouts";
import {
  MAX_PHOTO_PAGES,
  fitPlanToPages,
  planPages,
  reconcilePlan,
  type ChapterLayout,
  type PlannablePhoto,
} from "@/lib/book/page-plan";
import type {
  BookMeta,
  BookPage,
  Chapter,
  LayoutId,
  PhotoLayoutId,
  PlannedPage,
} from "@/types/book";
import type { Orientation } from "@/types/photo";

/**
 * The most photo pages a chapter can run to. The opener is the first of its
 * story pages, and a chapter is at most `MAX_STORY_PAGES_PER_CHAPTER` long.
 */
export const PHOTO_PAGES_PER_CHAPTER = MAX_PHOTO_PAGES;

/**
 * What pagination needs to know about a photograph: which way it faces, and
 * enough about when and where it was taken to group it with the ones it
 * belongs beside.
 */
export type PagePhoto = {
  orientation: Orientation;
  capturedAt?: number | null;
  lat?: number;
  lng?: number;
};

export type PhotoLookup = Map<string, PagePhoto>;

/**
 * Builds the complete interior page list:
 * title, then 10 pages per chapter, then closing and imprint.
 *
 * Page count is therefore at most `chapters * 10 + 3`; the print file pads
 * back to the ordered count (`padToPageCount` in the interior renderer).
 */
export function paginateBook(
  meta: BookMeta,
  chapters: Chapter[],
  photos: PhotoLookup = new Map(),
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
    // The chapter's pages, photographs and lines together. Nothing below
    // regroups them: a page prints the group it was given, which is why the
    // line on it can only ever be the one written about those photographs.
    const { pages: planned } = layOutChapter(chapter, body, chosen, photos);

    for (let index = 0; index < planned.length; index += 1) {
      const slice = planned[index]!.photos;
      // A chapter is only as long as its photographs: a page with none left
      // for it is not printed at all.
      if (slice.length === 0) continue;
      const wanted = chosen[index];
      const pageId = `page-${chapter.id}-${index}`;

      const layoutId: PhotoLayoutId =
        wanted && layoutPhotoCount(wanted) === slice.length
          ? wanted
          : chooseLayout(
              slice.map((id) => photos.get(id)?.orientation ?? "landscape"),
              { recent, seed: pageId, wantsWords: wantsWords(photoPages) },
            );

      recent.push(layoutId);
      if (recent.length > RECENT_MEMORY) recent.shift();
      photoPages += 1;

      const ordered =
        slice.length > 1
          ? assignToSlots(
              layoutId,
              slice.map((id) => ({
                id,
                orientation: photos.get(id)?.orientation ?? "landscape",
              })),
            )
          : slice;

      const pageNotes = notesForPage(notes[index], layoutNoteCount(layoutId));
      // The line written about exactly these photographs when the chapter was
      // written — it came off the same planned page they did. Printed only
      // where the page's layout keeps room for words, and only where the owner
      // has not written something of their own.
      const caption = planned[index]!.caption;

      push({
        id: pageId,
        kind: "photos",
        layoutId,
        photoIds: ordered,
        chapterId: chapter.id,
        chapterIndex: chapter.index,
        chapterPageIndex: index,
        ...(pageNotes ? { notes: pageNotes } : {}),
        ...(caption ? { caption } : {}),
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
 * Pages the book means to give room for words: every other one.
 *
 * Every page has a line written for it when the chapter is written, so the
 * question is only how often a page's layout makes room to print it. Every
 * other page reads like an album somebody wrote in; every page reads like a
 * diary, and none like a catalogue.
 */
function wantsWords(photoPagesSoFar: number): boolean {
  return photoPagesSoFar % 2 === 1;
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
 * The chapter's pages as they were planned, brought in line with the
 * photographs it holds now — or a fresh grouping for a chapter saved before
 * the book kept one.
 */
function chapterPlan(
  chapter: Pick<Chapter, "pagePlan">,
  body: readonly string[],
  photos: PhotoLookup,
): PlannedPage[] {
  const kept = reconcilePlan(chapter.pagePlan, body);
  if (kept) return kept;
  if (body.length === 0) return [];
  return planPages(body.map((id) => plannable(id, photos)));
}

/**
 * How a chapter's photographs actually fall on its pages.
 *
 * The one place that answers it, so the editor and the printed book can never
 * hold different opinions about which photographs share a page — and
 * therefore about which line belongs on it.
 */
function layOutChapter(
  chapter: Pick<Chapter, "pagePlan">,
  body: readonly string[],
  chosen: readonly (PhotoLayoutId | null)[],
  photos: PhotoLookup,
): ChapterLayout {
  return fitPlanToPages(chapterPlan(chapter, body, photos), capacitiesOf(chosen));
}

/** What each page must hold, for the pages whose owner chose a layout. */
function capacitiesOf(chosen: readonly (PhotoLayoutId | null)[]): (number | null)[] {
  return chosen.map((id) => (id ? layoutPhotoCount(id) : null));
}

function plannable(id: string, photos: PhotoLookup): PlannablePhoto {
  const photo = photos.get(id);
  return { id, capturedAt: photo?.capturedAt, lat: photo?.lat, lng: photo?.lng };
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
 * Puts new photographs onto one of a chapter's pages.
 *
 * What somebody means by adding a photograph while looking at a page is that
 * it belongs on *that* page. Before this, an upload from the editor joined the
 * album and nothing else: it was not in the chapter, not on the page, and not
 * even offered as a swap, because the chapter's candidates were settled when
 * it was written.
 *
 * So the page grows to hold it. A page of pictures alone takes up to six, a
 * page that also keeps room for words up to four — the catalogue's own limits,
 * the same in every design — and the layout is replaced with one of the new
 * size that keeps the page's mind about words. Anything past that ceiling is
 * not crammed in: it stays in the chapter, in order, right behind the page it
 * was meant for, and pagination deals it onto the pages that follow, which is
 * where the customer is then sent.
 */
export function addPhotosToPage(
  chapter: Chapter,
  pageIndex: number,
  incoming: readonly string[],
  page: { photoIds: readonly string[]; layoutId: PhotoLayoutId | null },
): { chapter: Chapter; placedHere: number; overflow: number } {
  const fresh = incoming.filter(
    (id) => id && !chapter.photoIds.includes(id),
  );
  if (fresh.length === 0 || pageIndex < 0) {
    return { chapter, placedHere: 0, overflow: 0 };
  }

  // Behind the last photograph already on the page, so the new ones read as
  // having joined that page rather than the end of the chapter.
  const last = page.photoIds.at(-1);
  const at = last ? chapter.photoIds.indexOf(last) + 1 : chapter.photoIds.length;
  const photoIds = [...chapter.photoIds];
  photoIds.splice(at < 1 ? photoIds.length : at, 0, ...fresh);

  const withWords = layoutNoteCount(page.layoutId) > 0;
  const ceiling = maxPhotosOnPage(withWords);
  const placedHere = Math.max(
    0,
    Math.min(fresh.length, ceiling - page.photoIds.length),
  );

  const chosen = chapterPageLayouts(chapter);
  if (placedHere > 0 && pageIndex < chosen.length) {
    const grown = layoutForCount(page.photoIds.length + placedHere, withWords);
    if (grown) chosen[pageIndex] = grown;
  }

  return {
    chapter: {
      ...chapter,
      photoIds,
      // Added to the chapter's candidates as well, or a photograph put on a
      // page could never afterwards be swapped for another.
      candidateIds: [
        ...chapter.candidateIds,
        ...fresh.filter((id) => !chapter.candidateIds.includes(id)),
      ],
      pageLayouts: withoutTrailingDefaults(chosen),
    },
    placedHere,
    overflow: fresh.length - placedHere,
  };
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
  // The chapter's grouping, read once and then edited — not read, edited, and
  // read again from a photo list that has changed underneath it. Re-deriving
  // it the second time is how a page that was about to gain four photographs
  // ends up somewhere else in the chapter entirely.
  const plan = chapterPlan(chapter, body, new Map()).map((page) => ({
    ...page,
    photos: [...page.photos],
  }));
  // Laid out exactly as the book lays it out, so what this reads off the page
  // is what is actually on it.
  const onPage =
    fitPlanToPages(plan, capacitiesOf(before)).pages[pageIndex]?.photos ?? [];

  if (layoutId) {
    const need = layoutPhotoCount(layoutId) - onPage.length;
    if (need > 0) {
      const spares = nearestSpares(chapter, onPage, pageIndex, need).filter(
        (id) => id !== hero,
      );
      // Onto the page they were chosen for, in the grouping itself. Dropped
      // into the chapter's photo list and left to be regrouped, they landed
      // wherever the regrouping felt like putting them — which on a chapter
      // already at its full length was a different page.
      const target = plan[pageIndex];
      if (target) target.photos.push(...spares);
      else plan.push({ photos: [...spares] });
      // Beside the page's own photographs in the chapter, so the book reads
      // in the order the pages do.
      const at = onPage.length > 0 ? body.indexOf(onPage.at(-1)!) + 1 : body.length;
      body.splice(Math.max(0, Math.min(at, body.length)), 0, ...spares);
    }
  }

  return settleChapter(chapter, plan, body, chosen, chapterPageNotes(chapter), hero);
}

/**
 * Writes a chapter's pages back onto it: the grouping, the layouts chosen for
 * it, the words written on it, and the photographs that are actually placed.
 *
 * The grouping is kept rather than thrown away and guessed at again, and that
 * is the point. A chapter whose grouping is re-derived on every edit has no
 * stable pages at all: add four photographs and the whole chapter regroups
 * around them, which moves every line onto photographs it was not written
 * about and moves every chosen layout onto a page its owner never picked it
 * for. Kept, the grouping only ever changes where this edit changed it, and
 * a line stays with its own photographs because they stay together.
 *
 * Pages left with nothing on them are dropped, and the layouts and notes are
 * dropped with them in the same pass — they are all indexed by page, so they
 * have to be cut in step or a page inherits the layout meant for another.
 */
function settleChapter(
  chapter: Chapter,
  plan: readonly PlannedPage[],
  body: readonly string[],
  chosen: readonly (PhotoLayoutId | null)[],
  notes: readonly ((string | null)[] | null)[],
  hero: string | null,
): Chapter {
  const laid = fitPlanToPages(plan, capacitiesOf(chosen));
  const kept = laid.pages
    .map((page, index) => ({
      page,
      layout: chosen[index] ?? null,
      note: notes[index] ?? null,
    }))
    .filter((entry) => entry.page.photos.length > 0);

  const dropped = new Set(laid.leftover);
  const photoIds = body.filter((id) => !dropped.has(id));
  const heroAt = hero ? chapter.photoIds.indexOf(hero) : -1;
  if (hero && heroAt !== -1) photoIds.splice(Math.min(heroAt, photoIds.length), 0, hero);

  return {
    ...chapter,
    photoIds,
    pagePlan: kept.map((entry) => entry.page),
    pageLayouts: withoutTrailingDefaults(kept.map((entry) => entry.layout)),
    pageNotes: withoutTrailingNotes(kept.map((entry) => entry.note)),
  };
}

/** Trailing "let the book decide" entries carry no information. */
function withoutTrailingDefaults(
  layouts: (PhotoLayoutId | null)[],
): (PhotoLayoutId | null)[] | undefined {
  const kept = [...layouts];
  while (kept.length > 0 && kept.at(-1) === null) kept.pop();
  return kept.length > 0 ? kept : undefined;
}

/** The same, for pages nobody has written anything on. */
function withoutTrailingNotes(
  notes: ((string | null)[] | null)[],
): ((string | null)[] | null)[] | undefined {
  const kept = [...notes];
  while (kept.length > 0 && kept.at(-1) === null) kept.pop();
  return kept.length > 0 ? kept : undefined;
}

export const CLOSING_LINE = "Always part of the story.";

/** "Biscuit" -> "Biscuit's", "Gus" -> "Gus'", unnamed -> "their". */
export function possessivePetName(petName: string): string {
  const name = petName.trim();
  if (!name) return "their";
  return /s$/i.test(name) ? `${name}'` : `${name}'s`;
}

/**
 * Drops the dedication page from a saved page list.
 *
 * Books saved while the book still had a dedication page carry one, and
 * re-paginating them from scratch would throw away every layout the customer
 * picked — so the page is removed and the rest renumbered in place.
 */
export function withoutDedicationPages(pages: BookPage[]): BookPage[] {
  const isDedication = (page: BookPage): boolean =>
    (page.kind as string) === "dedication";
  if (!pages.some(isDedication)) return pages;
  return pages
    .filter((page) => !isDedication(page))
    .map((page, index) => ({ ...page, pageNumber: index + 1 }));
}

/** The title page's heading: "For Biscuit". */
export function titlePageHeading(petName: string): string {
  const name = petName.trim();
  return name ? `For ${name}` : "Their Story";
}
