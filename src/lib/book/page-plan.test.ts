import { describe, expect, it } from "vitest";

import type { PlannedPage } from "@/types/book";
import {
  MAX_PHOTO_PAGES,
  MIN_PHOTO_PAGES,
  planFromIndexes,
  planPages,
  reconcilePlan,
  type PlannablePhoto,
} from "@/lib/book/page-plan";

const DAY = 86_400_000;

const photosOf = (pages: PlannedPage[]): string[][] => pages.map((page) => page.photos);
const START = Date.UTC(2019, 5, 1, 9);

/** Photographs taken in bursts: `[count, dayOffset]` pairs. */
function album(bursts: [number, number][]): PlannablePhoto[] {
  const photos: PlannablePhoto[] = [];
  for (const [count, day] of bursts) {
    for (let index = 0; index < count; index += 1) {
      photos.push({
        id: `p${photos.length}`,
        capturedAt: START + day * DAY + index * 4 * 60_000,
      });
    }
  }
  return photos;
}

describe("grouping a chapter's photographs onto pages", () => {
  it("gives a photograph its own page while the chapter has pages to spare", () => {
    const pages = planPages(album([[1, 0], [1, 30], [1, 60], [1, 90], [1, 120]]));
    expect(photosOf(pages)).toEqual([["p0"], ["p1"], ["p2"], ["p3"], ["p4"]]);
  });

  it("puts one afternoon together before it puts two apart", () => {
    // Twelve photographs: three outings of four, a month between them, and
    // nine pages to hold them.
    const pages = planPages(album([[4, 0], [4, 30], [4, 60]]));

    expect(pages.length).toBeLessThanOrEqual(MAX_PHOTO_PAGES);
    for (const page of pages) {
      // No page straddles two outings: every page's photographs were taken
      // within a day of each other.
      const numbers = page.photos.map((id) => Number(id.slice(1)));
      const outing = new Set(numbers.map((n) => Math.floor(n / 4)));
      expect(outing.size).toBe(1);
    }
  });

  it("never runs a chapter past its page budget, however big the album", () => {
    // Six to a page over nine pages is all a chapter can hold; a chapter is
    // never given more than that (see `selectRepresentatives`).
    for (const count of [1, 2, 5, 9, 10, 20, 30, 40, 50]) {
      const pages = planPages(album([[count, 0]]));
      expect(pages.length).toBeLessThanOrEqual(MAX_PHOTO_PAGES);
      expect(pages.length).toBeGreaterThan(0);
      if (count >= MIN_PHOTO_PAGES) {
        expect(pages.length).toBeGreaterThanOrEqual(MIN_PHOTO_PAGES);
      }
      // Every photograph exactly once, in order.
      expect(photosOf(pages).flat()).toEqual(album([[count, 0]]).map((photo) => photo.id));
    }
  });

  it("does not crowd a page while there are pages left", () => {
    const pages = planPages(album([[9, 0]]));
    expect(pages.every((page) => page.photos.length === 1)).toBe(true);
  });
});

describe("a grouping the model sent back", () => {
  const ids = ["a", "b", "c", "d", "e"];

  it("becomes pages of the chapter's own photographs, with the lines written for them", () => {
    expect(
      planFromIndexes(ids, [
        { photos: [0, 1], caption: "The first morning." },
        { photos: [2] },
        { photos: [3, 4], caption: "  " },
      ]),
    ).toEqual([
      { photos: ["a", "b"], caption: "The first morning." },
      { photos: ["c"] },
      { photos: ["d", "e"] },
    ]);
  });

  it("never loses a photograph the model forgot, or repeated", () => {
    const pages = planFromIndexes(ids, [{ photos: [0, 0, 1] }, { photos: [2] }]);
    expect(photosOf(pages!).flat().sort()).toEqual([...ids].sort());
    expect(new Set(photosOf(pages!).flat()).size).toBe(ids.length);
  });

  it("ignores positions that are not photographs", () => {
    const pages = planFromIndexes(ids, [{ photos: [0, 99] }, { photos: [-1, 1] }]);
    expect(photosOf(pages!).flat().sort()).toEqual([...ids].sort());
  });

  it("is nothing at all when the model sent nothing usable", () => {
    expect(planFromIndexes(ids, undefined)).toBeNull();
    expect(planFromIndexes(ids, [])).toBeNull();
    expect(planFromIndexes([], [{ photos: [0] }])).toBeNull();
  });
});

describe("a grouping kept while the chapter is edited", () => {
  const plan = [
    { photos: ["a", "b"], caption: "Two of them." },
    { photos: ["c"] },
    { photos: ["d", "e"] },
  ];

  it("drops a photograph that has left the chapter, and keeps the line", () => {
    expect(reconcilePlan(plan, ["a", "b", "d", "e"])).toEqual([
      { photos: ["a", "b"], caption: "Two of them." },
      { photos: ["d", "e"] },
    ]);
  });

  it("reads a plan saved before pages carried a line", () => {
    expect(reconcilePlan([["a", "b"], ["c"]], ["a", "b", "c"])).toEqual([
      { photos: ["a", "b"] },
      { photos: ["c"] },
    ]);
  });

  it("puts a photograph that has arrived beside the ones it sits with", () => {
    const pages = reconcilePlan(plan, ["a", "b", "c", "new", "d", "e"]);
    expect(photosOf(pages!).flat()).toContain("new");
    expect(photosOf(pages!).flat()).toHaveLength(6);
    // Next to its neighbours in the chapter, not tacked onto the end.
    const page = pages!.find((entry) => entry.photos.includes("new"))!;
    expect(page.photos.some((id) => id === "c" || id === "d" || id === "e")).toBe(true);
  });

  it("is nothing at all when none of its photographs are left", () => {
    expect(reconcilePlan(plan, ["x", "y"])).toBeNull();
    expect(reconcilePlan(undefined, ["a"])).toBeNull();
  });
});
