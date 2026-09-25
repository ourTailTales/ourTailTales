import { describe, expect, it } from "vitest";

import {
  MAX_PHOTO_PAGES,
  MIN_PHOTO_PAGES,
  planFromIndexes,
  planPages,
  reconcilePlan,
  type PlannablePhoto,
} from "@/lib/book/page-plan";

const DAY = 86_400_000;
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
    expect(pages).toEqual([["p0"], ["p1"], ["p2"], ["p3"], ["p4"]]);
  });

  it("puts one afternoon together before it puts two apart", () => {
    // Twelve photographs: three outings of four, a month between them, and
    // nine pages to hold them.
    const pages = planPages(album([[4, 0], [4, 30], [4, 60]]));

    expect(pages.length).toBeLessThanOrEqual(MAX_PHOTO_PAGES);
    for (const page of pages) {
      // No page straddles two outings: every page's photographs were taken
      // within a day of each other.
      const numbers = page.map((id) => Number(id.slice(1)));
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
      expect(pages.flat()).toEqual(album([[count, 0]]).map((photo) => photo.id));
    }
  });

  it("does not crowd a page while there are pages left", () => {
    const pages = planPages(album([[9, 0]]));
    expect(pages.every((page) => page.length === 1)).toBe(true);
  });
});

describe("a grouping the model sent back", () => {
  const ids = ["a", "b", "c", "d", "e"];

  it("becomes pages of the chapter's own photographs", () => {
    expect(planFromIndexes(ids, [[0, 1], [2], [3, 4]])).toEqual([
      ["a", "b"],
      ["c"],
      ["d", "e"],
    ]);
  });

  it("never loses a photograph the model forgot, or repeated", () => {
    const pages = planFromIndexes(ids, [[0, 0, 1], [2]]);
    expect(pages!.flat().sort()).toEqual([...ids].sort());
    expect(new Set(pages!.flat()).size).toBe(ids.length);
  });

  it("ignores positions that are not photographs", () => {
    const pages = planFromIndexes(ids, [[0, 99], [-1, 1]]);
    expect(pages!.flat().sort()).toEqual([...ids].sort());
  });

  it("is nothing at all when the model sent nothing usable", () => {
    expect(planFromIndexes(ids, undefined)).toBeNull();
    expect(planFromIndexes(ids, [])).toBeNull();
    expect(planFromIndexes([], [[0]])).toBeNull();
  });
});

describe("a grouping kept while the chapter is edited", () => {
  const plan = [["a", "b"], ["c"], ["d", "e"]];

  it("drops a photograph that has left the chapter", () => {
    expect(reconcilePlan(plan, ["a", "b", "d", "e"])).toEqual([["a", "b"], ["d", "e"]]);
  });

  it("puts a photograph that has arrived beside the ones it sits with", () => {
    const pages = reconcilePlan(plan, ["a", "b", "c", "new", "d", "e"]);
    expect(pages!.flat()).toContain("new");
    expect(pages!.flat()).toHaveLength(6);
    // Next to its neighbours in the chapter, not tacked onto the end.
    const page = pages!.find((entry) => entry.includes("new"))!;
    expect(page.some((id) => id === "c" || id === "d" || id === "e")).toBe(true);
  });

  it("is nothing at all when none of its photographs are left", () => {
    expect(reconcilePlan(plan, ["x", "y"])).toBeNull();
    expect(reconcilePlan(undefined, ["a"])).toBeNull();
  });
});
