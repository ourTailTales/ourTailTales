import { describe, expect, it } from "vitest";

import { paginateBook } from "@/lib/book/pagination";
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
      dedication: "",
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
  });
});
