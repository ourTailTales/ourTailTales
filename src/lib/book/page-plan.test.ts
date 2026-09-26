import { describe, expect, it } from "vitest";

import type { PlannedPage } from "@/types/book";
import {
  MAX_PHOTO_PAGES,
  MIN_PHOTO_PAGES,
  captionIndexForPhotos,
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

describe("a line goes where its photographs went", () => {
  const plan = [
    { photos: ["a", "b"], caption: "The long slow middle of winter" },
    { photos: ["c"], caption: "Right up close" },
    { photos: ["d", "e"], caption: "Back at the lake by June" },
  ];

  it("finds the line written about this page's photographs", () => {
    expect(captionIndexForPhotos(plan, ["c"], new Set())).toBe(1);
    expect(captionIndexForPhotos(plan, ["d", "e"], new Set())).toBe(2);
  });

  it("follows the photographs when the grouping moved them", () => {
    // The page that now holds "c" is the second printed page, but the line
    // written for it is the plan's third. Indexing by position printed "Back
    // at the lake by June" over the close-up.
    expect(captionIndexForPhotos(plan, ["a", "b", "x"], new Set())).toBe(0);
    expect(captionIndexForPhotos(plan, ["c"], new Set([0]))).toBe(1);
  });

  it("gives a split page's line to the half that kept most of it", () => {
    const used = new Set<number>();
    const first = captionIndexForPhotos(plan, ["d"], used);
    expect(first).toBe(2);
    used.add(first!);
    // The other half has nothing left to claim, and keeps its date instead.
    expect(captionIndexForPhotos(plan, ["e"], used)).toBeNull();
  });

  it("has no line for photographs the plan never saw", () => {
    expect(captionIndexForPhotos(plan, ["new"], new Set())).toBeNull();
    expect(captionIndexForPhotos(undefined, ["a"], new Set())).toBeNull();
    expect(captionIndexForPhotos(plan, [], new Set())).toBeNull();
  });

  it("passes over a planned page that was given no line", () => {
    const partial = [{ photos: ["a"] }, { photos: ["b"], caption: "A line" }];
    expect(captionIndexForPhotos(partial, ["a"], new Set())).toBeNull();
    expect(captionIndexForPhotos(partial, ["b"], new Set())).toBe(1);
  });
});

describe("whichever way the model numbered the photographs", () => {
  const ids = ["p0", "p1", "p2", "p3"];

  it("reads a plan that counts from one, which is what the prompt asks for", () => {
    const pages = planFromIndexes(ids, [
      { photos: [1, 2], caption: "Out into the sunny green yard" },
      { photos: [3], caption: "Back indoors" },
      { photos: [4], caption: "The last of it" },
    ]);

    // Read as zero-based — which is what this used to do — the first line
    // would have landed on p1 and p2: the caption written about the first
    // photograph printed under the second. That is the page of a dog indoors
    // captioned "Out into the sunny green yard".
    expect(pages).toEqual([
      { photos: ["p0", "p1"], caption: "Out into the sunny green yard" },
      { photos: ["p2"], caption: "Back indoors" },
      { photos: ["p3"], caption: "The last of it" },
    ]);
  });

  it("still reads a plan that counts from zero", () => {
    const pages = planFromIndexes(ids, [
      { photos: [0, 1], caption: "First" },
      { photos: [2, 3], caption: "Second" },
    ]);
    expect(pages).toEqual([
      { photos: ["p0", "p1"], caption: "First" },
      { photos: ["p2", "p3"], caption: "Second" },
    ]);
  });

  it("treats a plan that skips the first photograph as counting from one", () => {
    // No zero and no number as high as the count: nothing decides it but the
    // numbering the prompt asked for, and the photograph left out comes back
    // through the reconciliation rather than being lost.
    const pages = planFromIndexes(ids, [{ photos: [2, 3], caption: "Only these" }]);
    expect(photosOf(pages!).flat()).toHaveLength(4);
    expect(pages!.some((page) => page.photos.includes("p1"))).toBe(true);
    expect(pages!.some((page) => page.photos.includes("p2"))).toBe(true);
  });

  it("keeps every photograph whichever base came back", () => {
    for (const planned of [
      [{ photos: [1, 2] }, { photos: [3, 4] }],
      [{ photos: [0, 1] }, { photos: [2, 3] }],
    ]) {
      const pages = planFromIndexes(ids, planned);
      expect(photosOf(pages!).flat().sort()).toEqual([...ids].sort());
    }
  });
});
