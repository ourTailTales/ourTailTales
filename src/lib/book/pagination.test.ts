import { describe, expect, it } from "vitest";

import { paginateBook, withoutEmptyDedication } from "@/lib/book/pagination";
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
