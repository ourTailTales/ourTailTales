import { describe, expect, it } from "vitest";

import {
  applyPageLayout,
  maxPhotosForPage,
  paginateBook,
  photoPageIndex,
  planChapterPages,
  sparePhotos,
  withoutEmptyDedication,
} from "@/lib/book/pagination";
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
          index % 3 === 0 ? ("portrait" as const) : ("landscape" as const),
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
    const pages = paginateBook(baseMeta, oneChapter);
    expect(pages.some((page) => page.kind === "dedication")).toBe(false);
    expect(pages).toHaveLength(13);
    expect(pages.map((page) => page.pageNumber)).toEqual(
      Array.from({ length: 13 }, (_, index) => index + 1),
    );

    const withSpacesOnly = paginateBook({ ...baseMeta, dedication: "   " }, oneChapter);
    expect(withSpacesOnly).toHaveLength(13);
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
