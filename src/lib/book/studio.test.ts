import { describe, expect, it } from "vitest";

import { buildSlides, followSelection, type StudioSlide } from "@/lib/book/studio";
import type { BookPage, Chapter } from "@/types/book";

function page(id: string, chapterId: string | null, pageNumber: number): BookPage {
  return {
    id,
    kind: chapterId ? "photos" : "title",
    layoutId: null,
    photoIds: [],
    pageNumber,
    ...(chapterId ? { chapterId, chapterIndex: 0 } : {}),
  } as BookPage;
}

function chapter(id: string, index: number): Chapter {
  return {
    id,
    index,
    photoIds: [],
    candidateIds: [],
    startAt: null,
    endAt: null,
    title: `Chapter ${index + 1}`,
    dateLabel: "",
    blurb: "",
    places: [],
    heroPhotoId: null,
    aiStatus: "done",
  };
}

/** A book of two chapters: `one` has as many pages as asked for, `two` has one. */
function book(pagesInFirst: number): StudioSlide[] {
  const pages: BookPage[] = [
    page("page-title", null, 1),
    ...Array.from({ length: pagesInFirst }, (_, index) =>
      page(`page-one-${index}`, "one", index + 2),
    ),
    page("page-two-0", "two", pagesInFirst + 2),
  ];
  return buildSlides(pages, [chapter("one", 0), chapter("two", 1)], { unlocked: true });
}

describe("following the selection through a repagination", () => {
  it("stays on the same page when nothing moved", () => {
    const before = book(3);
    expect(followSelection(before, book(3), 2)).toBe(2);
  });

  it("follows a page that came out of the rebuild at a new index", () => {
    const before = book(3);
    // The title page has gone, so every chapter page is one index earlier.
    const after = before.filter((slide) => slide.key !== "page-title");
    // Cover, title, one-0, one-1 → the reader is on `page-one-1`.
    expect(before[3]?.key).toBe("page-one-1");
    expect(followSelection(before, after, 3)).toBe(2);
    expect(after[2]?.key).toBe("page-one-1");
  });

  it("lands on the page that absorbed theirs, not on the next chapter", () => {
    const before = book(3);
    const after = book(2);
    // The reader is on the chapter's last page, which the rebuild dropped.
    expect(before[4]?.key).toBe("page-one-2");
    const next = followSelection(before, after, 4);
    expect(after[next]?.key).toBe("page-one-1");
    // The old index now means the next chapter, which is the bug this avoids.
    expect(after[4]?.chapterId).toBe("two");
  });

  it("steps back a page when the whole chapter has gone", () => {
    const before = book(2);
    const after = buildSlides(
      [page("page-title", null, 1), page("page-two-0", "two", 2)],
      [chapter("two", 1)],
      { unlocked: true },
    );
    expect(before[3]?.key).toBe("page-one-1");
    expect(followSelection(before, after, 3)).toBe(2);
  });

  it("holds a selection that is already past the end of the old book", () => {
    const before = book(2);
    expect(followSelection(before, book(2), 99)).toBe(before.length - 1);
  });

  it("has nowhere to go in an empty book", () => {
    expect(followSelection(book(2), [], 3)).toBe(0);
  });
});
