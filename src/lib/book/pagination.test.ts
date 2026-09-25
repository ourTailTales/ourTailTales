import { describe, expect, it } from "vitest";

import {
  isCaptionLayout,
  isPhotoLayout,
  layoutNoteCount,
  layoutPhotoCount,
} from "@/lib/book/layouts";
import {
  applyPageLayout,
  applyPageNote,
  chapterPageNotes,
  maxPhotosForPage,
  paginateBook,
  photoPageIndex,
  planChapterPages,
  sparePhotos,
  withoutEmptyDedication,
} from "@/lib/book/pagination";
import {
  MAX_STORY_PAGES_PER_CHAPTER,
  MIN_STORY_PAGES_PER_CHAPTER,
} from "@/lib/pricing";
import type { BookMeta, Chapter } from "@/types/book";

describe("automatic book pagination", () => {
  it("creates a five-chapter, 54-page book with varied layouts and no QR data", () => {
    const chapters: Chapter[] = Array.from({ length: 5 }, (_, index) => ({
      id: `chapter-${index + 1}`,
      index,
      photoIds: Array.from(
        { length: 30 },
        (_unused, photo) => `photo-${index}-${photo}`,
      ),
      candidateIds: [],
      startAt: null,
      endAt: null,
      title: `Chapter ${index + 1}`,
      dateLabel: "",
      blurb: "",
      places: [],
      heroPhotoId: `photo-${index}-0`,
      aiStatus: "idle",
    }));
    const meta: BookMeta = {
      petName: "Biscuit",
      birthYear: "",
      deathYear: "",
      dedication: "For Biscuit.",
      coverPhotoId: "photo-0-0",
    };
    const orientations = new Map(
      chapters.flatMap((chapter) =>
        chapter.photoIds.map((id, index) => [
          id,
          { orientation: index % 3 === 0 ? ("portrait" as const) : ("landscape" as const) },
        ]),
      ),
    );

    const pages = paginateBook(meta, chapters, orientations);
    const photoLayouts = new Set(
      pages
        .filter((page) => page.kind === "photos" && page.layoutId)
        .map((page) => page.layoutId),
    );

    expect(pages).toHaveLength(54);
    expect(photoLayouts.size).toBeGreaterThan(1);
    expect(JSON.stringify(pages)).not.toContain("qr");
    expect(pages[1]?.kind).toBe("dedication");
  });

  const oneChapter: Chapter[] = [
    {
      id: "chapter-1",
      index: 0,
      photoIds: ["a", "b", "c"],
      candidateIds: [],
      startAt: null,
      endAt: null,
      title: "Chapter 1",
      dateLabel: "",
      blurb: "",
      places: [],
      heroPhotoId: "a",
      aiStatus: "idle",
    },
  ];
  const baseMeta: BookMeta = {
    petName: "Biscuit",
    birthYear: "",
    deathYear: "",
    dedication: "",
    coverPhotoId: "a",
  };

  it("leaves the dedication page out when there is no dedication", () => {
    // One chapter of three photographs: the opener, a page for each of the
    // other two, and the book's own pages, less the dedication.
    const pages = paginateBook(baseMeta, oneChapter);
    expect(pages.some((page) => page.kind === "dedication")).toBe(false);
    expect(pages).toHaveLength(6);
    expect(pages.map((page) => page.pageNumber)).toEqual(
      Array.from({ length: 6 }, (_, index) => index + 1),
    );

    const withSpacesOnly = paginateBook({ ...baseMeta, dedication: "   " }, oneChapter);
    expect(withSpacesOnly).toHaveLength(6);
    expect(paginateBook({ ...baseMeta, dedication: "For Biscuit." }, oneChapter)).toHaveLength(7);
  });

  it("drops a saved empty dedication page and renumbers", () => {
    const saved = paginateBook({ ...baseMeta, dedication: "x" }, oneChapter);
    const cleaned = withoutEmptyDedication(saved, baseMeta);
    expect(cleaned).toHaveLength(saved.length - 1);
    expect(cleaned.some((page) => page.kind === "dedication")).toBe(false);
    expect(cleaned[1]?.pageNumber).toBe(2);
    expect(withoutEmptyDedication(saved, { dedication: "x" })).toBe(saved);
  });
});

describe("choosing a page's layout", () => {
  function chapter(photos: number, spares = 0): Chapter {
    const all = Array.from({ length: photos + spares }, (_, index) => `p${index}`);
    return {
      id: "chapter-1",
      index: 0,
      photoIds: all.slice(0, photos),
      candidateIds: all,
      startAt: null,
      endAt: null,
      title: "Chapter 1",
      dateLabel: "",
      blurb: "",
      places: [],
      heroPhotoId: "p0",
      aiStatus: "done",
    };
  }
  const meta: BookMeta = { petName: "Biscuit", birthYear: "", deathYear: "", dedication: "", coverPhotoId: "p0" };
  const photoPages = (chapters: Chapter[]) =>
    paginateBook(meta, chapters).filter((page) => page.kind === "photos");

  it("gives a chosen page exactly the photos its layout holds", () => {
    const plan = planChapterPages(20, [null, "six-grid", null, null, null, null, null, null, null]);
    expect(plan.counts[1]).toBe(6);
    expect(plan.counts.reduce((sum, count) => sum + count, 0)).toBe(20);
    expect(plan.leftover).toBe(0);
  });

  it("keeps back photos for a chosen layout later in the chapter", () => {
    const plan = planChapterPages(9, [null, null, null, null, null, null, null, null, "five-mosaic"]);
    expect(plan.counts[8]).toBe(5);
    expect(plan.counts.slice(0, 8).reduce((sum, count) => sum + count, 0)).toBe(4);
  });

  it("fills a bigger layout from the chapter's unused photos first", () => {
    const before = chapter(10, 8);
    const pagesBefore = photoPages([before]);
    const after = applyPageLayout(before, 2, "six-grid");
    const pages = photoPages([after]);

    expect(pages[2]!.layoutId).toBe("six-grid");
    expect(pages[2]!.photoIds).toHaveLength(6);
    // The other pages keep what they had.
    expect(pages[0]!.photoIds).toEqual(pagesBefore[0]!.photoIds);
    expect(pages[1]!.photoIds).toEqual(pagesBefore[1]!.photoIds);
    expect(after.photoIds.length).toBeGreaterThan(before.photoIds.length);
    expect(new Set(after.photoIds).size).toBe(after.photoIds.length);
  });

  it("takes the unused photos nearest in time to the page", () => {
    const all = Array.from({ length: 40 }, (_, index) => `p${index}`);
    const before: Chapter = { ...chapter(0), photoIds: all.filter((_, index) => index % 2 === 0), candidateIds: all };
    const pageBefore = photoPages([before])[7]!;
    const after = applyPageLayout(before, 7, "six-grid");
    const added = after.photoIds.filter((id) => !before.photoIds.includes(id));
    const lowest = Math.min(...pageBefore.photoIds.map((id) => Number(id.slice(1))));
    expect(added.length).toBeGreaterThan(0);
    for (const id of added) expect(Number(id.slice(1))).toBeGreaterThan(lowest - 6);
  });

  it("lets a smaller layout's extra photos flow onto the next pages", () => {
    const before = chapter(28);
    const after = applyPageLayout(before, 0, "full-bleed");
    const pages = photoPages([after]);
    expect(pages[0]!.layoutId).toBe("full-bleed");
    expect(pages[0]!.photoIds).toHaveLength(1);
    expect(pages.flatMap((page) => page.photoIds).sort()).toEqual(
      before.photoIds.filter((id) => id !== "p0").sort(),
    );
  });

  it("returns photos no page has room for to the unused pile", () => {
    let current = chapter(30);
    for (let page = 0; page < 9; page += 1) current = applyPageLayout(current, page, "full-bleed");
    expect(current.photoIds).toHaveLength(10);
    expect(sparePhotos(current)).toHaveLength(20);
    expect(photoPages([current]).every((page) => page.photoIds.length === 1)).toBe(true);
  });

  it("survives every other edit, and hands back to the book with null", () => {
    const chosen = applyPageLayout(chapter(20, 4), 3, "one-large-three-small");
    const renamed = { ...chosen, title: "A new title" };
    expect(photoPages([renamed])[3]!.layoutId).toBe("one-large-three-small");

    const auto = applyPageLayout(chosen, 3, null);
    expect(auto.pageLayouts).toBeUndefined();
  });

  it("knows how many photos a page could take", () => {
    const current = applyPageLayout(chapter(10, 3), 0, "four-grid");
    // 9 photos after the opener, plus 3 spares, less the 4 page 0 claims.
    expect(maxPhotosForPage(current, 1)).toBe(8);
    expect(maxPhotosForPage(current, 0)).toBe(12);
  });

  it("finds a page's place in its chapter, including on pages saved without it", () => {
    const pages = photoPages([chapter(20)]);
    expect(photoPageIndex(pages[4]!)).toBe(4);
    expect(photoPageIndex({ ...pages[4]!, chapterPageIndex: undefined })).toBe(4);
  });
});

describe("a book that does not look machine-made", () => {
  function fullBook(photosPerChapter = 28) {
    const chapters: Chapter[] = Array.from({ length: 5 }, (_, index) => ({
      id: `chapter-${index + 1}`,
      index,
      photoIds: Array.from({ length: photosPerChapter }, (_u, photo) => `p-${index}-${photo}`),
      candidateIds: [],
      startAt: null,
      endAt: null,
      title: `Chapter ${index + 1}`,
      dateLabel: "Summer 2019",
      blurb: "",
      places: [],
      heroPhotoId: `p-${index}-0`,
      aiStatus: "done" as const,
    }));
    const meta: BookMeta = {
      petName: "Biscuit",
      birthYear: "",
      deathYear: "",
      dedication: "For Biscuit.",
      coverPhotoId: "p-0-0",
    };
    const orientations = new Map(
      chapters.flatMap((chapter) =>
        chapter.photoIds.map((id, index) => [
          id,
          { orientation: index % 3 === 0 ? ("portrait" as const) : ("landscape" as const) },
        ]),
      ),
    );
    return { chapters, meta, pages: paginateBook(meta, chapters, orientations) };
  }

  it("deals many different layouts, some of them holding words", () => {
    const { pages } = fullBook();
    const photoPages = pages.filter((page) => page.kind === "photos");
    const layouts = photoPages.map((page) => page.layoutId!);

    expect(new Set(layouts).size).toBeGreaterThanOrEqual(8);
    expect(layouts.filter((id) => isCaptionLayout(id)).length).toBeGreaterThanOrEqual(5);
    // Varied page counts, including the occasional page-sized photograph.
    const counts = new Set(photoPages.map((page) => page.photoIds.length));
    expect(counts.size).toBeGreaterThanOrEqual(2);
  });

  it("still gives the free preview a mix, in its first few pages", () => {
    const { pages } = fullBook();
    // The teaser is the front of the book: nine interior pages.
    const teaser = pages.slice(0, 9).filter((page) => page.kind === "photos");
    expect(new Set(teaser.map((page) => page.layoutId)).size).toBe(teaser.length);
    expect(teaser.some((page) => isCaptionLayout(page.layoutId))).toBe(true);
  });

  it("makes a thin album a short book rather than an empty one", () => {
    // Twenty-five photographs, five chapters: five to a chapter, one on the
    // opener and one on each of four pages. A five-page chapter, not a
    // ten-page chapter with five sheets of blank paper in it.
    const { pages } = fullBook(5);
    const photoPages = pages.filter((page) => page.kind === "photos");

    expect(photoPages).toHaveLength(5 * 4);
    for (const page of photoPages) expect(page.photoIds).toHaveLength(1);
    // Nothing is left out: every photograph the chapters hold is on a page.
    const placed = new Set(pages.flatMap((page) => page.photoIds));
    expect(placed.size).toBe(5 * 5);
    // Five chapters of five pages, and the book's own four.
    expect(pages).toHaveLength(5 * 5 + 4);
  });

  it("keeps a chapter between three and ten pages", () => {
    for (const perChapter of [2, 3, 5, 12, 30, 60]) {
      const { pages } = fullBook(perChapter);
      const byChapter = new Map<string, number>();
      for (const page of pages) {
        if (!page.chapterId) continue;
        byChapter.set(page.chapterId, (byChapter.get(page.chapterId) ?? 0) + 1);
      }
      for (const length of byChapter.values()) {
        expect(length).toBeLessThanOrEqual(MAX_STORY_PAGES_PER_CHAPTER);
        // A chapter of two photographs cannot reach three pages, and is not
        // padded to it.
        if (perChapter >= MIN_STORY_PAGES_PER_CHAPTER) {
          expect(length).toBeGreaterThanOrEqual(MIN_STORY_PAGES_PER_CHAPTER);
        }
      }
    }
  });

  it("puts a photograph on every page it makes, at any album size", () => {
    for (const perChapter of [3, 5, 7, 9, 12, 19, 28, 45]) {
      const counts = fullBook(perChapter)
        .pages.filter((entry) => entry.kind === "photos")
        .map((entry) => entry.photoIds.length);

      expect(counts.every((count) => count > 0)).toBe(true);
      // Photographs only share a page once a chapter has more of them than
      // it has pages.
      const shared = counts.some((count) => count > 1);
      expect(shared).toBe(perChapter - 1 > MAX_STORY_PAGES_PER_CHAPTER - 1);
    }
  });

  it("never repeats a layout twice running, and never leaves a page empty", () => {
    const { pages } = fullBook(22);
    const photoPages = pages.filter((page) => page.kind === "photos");
    for (const page of photoPages) {
      expect(page.photoIds.length).toBeGreaterThan(0);
      expect(isPhotoLayout(page.layoutId)).toBe(true);
      if (isPhotoLayout(page.layoutId)) {
        expect(page.photoIds).toHaveLength(layoutPhotoCount(page.layoutId));
      }
    }
    for (let index = 1; index < photoPages.length; index += 1) {
      expect(photoPages[index]!.layoutId).not.toBe(photoPages[index - 1]!.layoutId);
    }
  });

  it("places every photograph a chapter has", () => {
    for (const perChapter of [12, 19, 28, 34]) {
      const { chapters, pages } = fullBook(perChapter);
      const placed = new Set(pages.flatMap((page) => page.photoIds));
      for (const id of chapters[0]!.photoIds) expect(placed.has(id)).toBe(true);
    }
  });

  it("lays the same book out the same way every time", () => {
    expect(fullBook().pages).toEqual(fullBook().pages);
  });
});

describe("words written on a page", () => {
  const chapter: Chapter = {
    id: "chapter-1",
    index: 0,
    photoIds: Array.from({ length: 20 }, (_, index) => `p${index}`),
    candidateIds: [],
    startAt: null,
    endAt: null,
    title: "Chapter 1",
    dateLabel: "Summer 2019",
    blurb: "",
    places: [],
    heroPhotoId: "p0",
    aiStatus: "done",
  };
  const meta: BookMeta = {
    petName: "Biscuit",
    birthYear: "",
    deathYear: "",
    dedication: "",
    coverPhotoId: "p0",
  };

  it("rides from the chapter onto the page it was written on", () => {
    const withLayout = applyPageLayout(chapter, 2, "caption-right-2");
    const written = applyPageNote(withLayout, 2, 0, "He met the water all at once.");
    const page = paginateBook(meta, [written]).filter((entry) => entry.kind === "photos")[2]!;

    expect(page.layoutId).toBe("caption-right-2");
    expect(page.notes).toEqual(["He met the water all at once.", null]);
    expect(layoutNoteCount(page.layoutId)).toBe(2);
  });

  it("clears a note that is emptied, and keeps the chapter tidy", () => {
    const written = applyPageNote(chapter, 1, 0, "Something.");
    expect(chapterPageNotes(written)[1]).toEqual(["Something."]);

    const cleared = applyPageNote(written, 1, 0, "   ");
    expect(cleared.pageNotes).toBeUndefined();
  });

  it("keeps a note off a page whose layout has nowhere to put it", () => {
    const written = applyPageNote(applyPageLayout(chapter, 0, "four-grid"), 0, 0, "Nowhere to go.");
    const page = paginateBook(meta, [written]).filter((entry) => entry.kind === "photos")[0]!;
    expect(page.layoutId).toBe("four-grid");
    expect(page.notes).toBeUndefined();
    // The words are not lost — they come back if the page takes a layout that holds them.
    expect(chapterPageNotes(written)[0]).toEqual(["Nowhere to go."]);
  });

  it("refuses a third note on a page", () => {
    const written = applyPageNote(chapter, 0, 2, "One too many.");
    expect(written.pageNotes).toBeUndefined();
  });
});
