import { describe, expect, it } from "vitest";

import type { PlannedPage } from "@/types/book";
import {
  MAX_PHOTO_PAGES,
  MIN_PHOTO_PAGES,
  captionBelongsOn,
  fitPlanToPages,
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

describe("two photographs of one moment", () => {
  /** The same scene twice: minutes apart, one spot, hashes a few bits apart. */
  const scene = (
    id: string,
    minutes: number,
    dHash: string,
  ): PlannablePhoto => ({
    id,
    capturedAt: START + minutes * 60_000,
    lat: 47.61,
    lng: -122.33,
    dHash,
  });

  const SAME = "ffff0000ffff0000";
  const NEARLY = "ffff0000ffff000f";
  const NOTHING_ALIKE = "0f0f0f0f0f0f0f0f";

  it("share a page even in a chapter with pages to spare", () => {
    const pages = planPages([
      scene("a", 0, SAME),
      scene("b", 3, NEARLY),
      scene("c", 600, NOTHING_ALIKE),
      scene("d", 1200, "00ff00ff00ff00ff"),
      scene("e", 1800, "f000f000f000f000"),
    ]);
    expect(photosOf(pages)).toEqual([["a", "b"], ["c"], ["d"], ["e"]]);
  });

  it("stay apart when only their timestamps are close", () => {
    // Four minutes apart in the same spot, and of completely different
    // things: the camera was out, which is not the same as one moment.
    const pages = planPages([
      scene("a", 0, SAME),
      scene("b", 4, NOTHING_ALIKE),
      scene("c", 600, "00ff00ff00ff00ff"),
    ]);
    expect(photosOf(pages)).toEqual([["a"], ["b"], ["c"]]);
  });

  it("stay apart when the same scene was shot hours later", () => {
    const pages = planPages([
      scene("a", 0, SAME),
      scene("b", 60 * 6, NEARLY),
      scene("c", 60 * 20, NOTHING_ALIKE),
    ]);
    expect(photosOf(pages)).toEqual([["a"], ["b"], ["c"]]);
  });

  it("never takes a chapter below the pages it must have", () => {
    const burst = Array.from({ length: 6 }, (_, index) =>
      scene(`p${index}`, index * 2, index % 2 === 0 ? SAME : NEARLY),
    );
    const pages = planPages(burst);
    expect(pages.length).toBeGreaterThanOrEqual(MIN_PHOTO_PAGES);
    expect(photosOf(pages).flat()).toEqual(burst.map((photo) => photo.id));
    // Three of one moment is as many as a page takes of its own accord.
    expect(Math.max(...pages.map((page) => page.photos.length))).toBeLessThanOrEqual(3);
  });

  it("leaves an album with no hashes exactly as it was", () => {
    const pages = planPages(album([[9, 0]]));
    expect(pages.every((page) => page.photos.length === 1)).toBe(true);
  });
});

describe("crowding a chapter that has more photographs than pages", () => {
  it("puts the ones that look alike together rather than the ones next in line", () => {
    // Twenty photographs three hours apart — far enough that none of them is
    // one moment shot twice, so every neighbouring gap is identical and only
    // what the pictures look like can tell the pairs apart. Odd indices
    // deliberately: merging left to right, which is what happens when
    // nothing distinguishes two pairs, would pair 0 with 1 and never 1
    // with 2.
    const twins = new Set([1, 5, 9, 13, 17]);
    const sceneOf = (index: number): number => (twins.has(index) ? index : index - 1);
    const photos: PlannablePhoto[] = Array.from({ length: 20 }, (_, index) => ({
      id: `p${index}`,
      capturedAt: START + index * 3 * 3_600_000,
      // A twin and the photograph after it are the same scene; the rest are
      // unrelated to everything.
      dHash:
        twins.has(index) || twins.has(index - 1)
          ? `${sceneOf(index).toString(16).padStart(2, "0")}ff00ff00ff00ff`
          : `${index.toString(16).padStart(2, "0")}0f1e2d3c4b5a69`,
    }));

    const pages = planPages(photos);
    // Every twin ended up on a page with its own pair.
    for (const index of twins) {
      const page = pages.find((entry) => entry.photos.includes(`p${index}`))!;
      expect(page.photos).toContain(`p${index + 1}`);
    }
    expect(photosOf(pages).flat()).toEqual(photos.map((photo) => photo.id));
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
      // The line comes back knowing which photographs it was written about.
      { photos: ["a", "b"], caption: "The first morning.", captionFor: ["a", "b"] },
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
      { photos: ["a", "b"], caption: "Two of them.", captionFor: ["a", "b"] },
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

describe("a line never leaves its photographs", () => {
  const plan: PlannedPage[] = [
    { photos: ["a", "b"], caption: "The long slow middle of winter", captionFor: ["a", "b"] },
    { photos: ["c"], caption: "Right up close", captionFor: ["c"] },
    { photos: ["d", "e"], caption: "Back at the lake by June", captionFor: ["d", "e"] },
  ];

  it("prints every line on the page it was written for, left alone", () => {
    const { pages, leftover } = fitPlanToPages(plan);
    expect(photosOf(pages)).toEqual([["a", "b"], ["c"], ["d", "e"]]);
    expect(pages.map((page) => page.caption)).toEqual([
      "The long slow middle of winter",
      "Right up close",
      "Back at the lake by June",
    ]);
    expect(leftover).toEqual([]);
  });

  it("carries a line onto a chosen layout that swallowed its page", () => {
    // Three to the first page, so the plan's first two pages become one.
    // Counting pages instead would print "Right up close" — the line about
    // "c", which is on page one now — over "d" and "e".
    const { pages } = fitPlanToPages(plan, [3]);
    expect(photosOf(pages)).toEqual([["a", "b", "c"], [], ["d", "e"]]);
    expect(pages[0]?.caption).toBe("The long slow middle of winter");
    expect(pages[2]?.caption).toBe("Back at the lake by June");
    expect(pages.map((page) => page.caption)).not.toContain("Right up close");
  });

  it("drops a line once the page is mostly other photographs", () => {
    // One stray shared photograph is not the same occasion as the other
    // three: a page keeps no line sooner than it prints one true of a
    // quarter of what is on it.
    expect(
      captionBelongsOn({ photos: ["c", "x", "y", "z"], caption: "L", captionFor: ["c"] }),
    ).toBe(false);
    expect(
      captionBelongsOn({ photos: ["d", "e", "x"], caption: "L", captionFor: ["d", "e"] }),
    ).toBe(true);
  });

  it("drops a line once most of what it was written about has gone", () => {
    // A line about six photographs, printed under the one that is left, is a
    // line about five pictures that are not on the page.
    const written = ["p1", "p2", "p3", "p4", "p5", "p6"];
    expect(
      captionBelongsOn({ photos: ["p1"], caption: "All six of them", captionFor: written }),
    ).toBe(false);
    expect(
      captionBelongsOn({
        photos: ["p1", "p2", "p3", "p4"],
        caption: "All six",
        captionFor: written,
      }),
    ).toBe(true);
  });

  it("has no line for a page that was given none, or has no photographs", () => {
    expect(captionBelongsOn({ photos: ["a"] })).toBe(false);
    expect(captionBelongsOn({ photos: [], caption: "A line", captionFor: [] })).toBe(false);
    expect(captionBelongsOn({ photos: ["a"], caption: "   ", captionFor: ["a"] })).toBe(false);
  });

  it("falls back to the page's own photographs on a plan saved without the set", () => {
    expect(captionBelongsOn({ photos: ["a", "b"], caption: "A line" })).toBe(true);
  });

  it("gives a chosen page exactly the photographs its layout holds", () => {
    const wide: PlannedPage[] = [
      { photos: ["a", "b", "c"] },
      { photos: ["d", "e", "f"] },
      { photos: ["g"] },
    ];
    const { pages, leftover } = fitPlanToPages(wide, [null, 1]);
    expect(photosOf(pages)).toEqual([["a", "b", "c"], ["d"], ["e", "f", "g"]]);
    expect(leftover).toEqual([]);
  });

  it("claims a page the plan never reached, and fills it from the pages before it", () => {
    // Nothing after it to draw on, so a layout its owner chose is honoured
    // out of what came before rather than quietly ignored.
    const { pages } = fitPlanToPages([{ photos: ["a", "b", "c", "d"] }], [null, null, 2]);
    expect(photosOf(pages)).toEqual([["a", "b"], [], ["c", "d"]]);
  });

  it("leaves a page its owner also chose alone when filling another", () => {
    const { pages } = fitPlanToPages(
      [{ photos: ["a"] }, { photos: ["b", "c"] }, { photos: ["d"] }],
      [1, null, 3],
    );
    // Page one gives way; page zero keeps the single photograph asked for.
    expect(photosOf(pages)).toEqual([["a"], [], ["b", "c", "d"]]);
  });

  it("leaves a photograph no page had room for out of the book", () => {
    const full: PlannedPage[] = Array.from({ length: MAX_PHOTO_PAGES }, (_, index) => ({
      photos: Array.from({ length: 6 }, (_u, slot) => `p${index}-${slot}`),
    }));
    const { pages, leftover } = fitPlanToPages(full, [1]);
    expect(pages).toHaveLength(MAX_PHOTO_PAGES);
    expect(pages[0]!.photos).toEqual(["p0-0"]);
    expect(leftover).toHaveLength(5);
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
      {
        photos: ["p0", "p1"],
        caption: "Out into the sunny green yard",
        captionFor: ["p0", "p1"],
      },
      { photos: ["p2"], caption: "Back indoors", captionFor: ["p2"] },
      { photos: ["p3"], caption: "The last of it", captionFor: ["p3"] },
    ]);
  });

  it("still reads a plan that counts from zero", () => {
    const pages = planFromIndexes(ids, [
      { photos: [0, 1], caption: "First" },
      { photos: [2, 3], caption: "Second" },
    ]);
    expect(pages).toEqual([
      { photos: ["p0", "p1"], caption: "First", captionFor: ["p0", "p1"] },
      { photos: ["p2", "p3"], caption: "Second", captionFor: ["p2", "p3"] },
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

  it("does not let one stray zero shift every other, clearly one-based group", () => {
    // Five photos, numbered 1 to 5. One group mistakenly writes "0" — a slip,
    // not a signal that the whole plan is zero-based — while another group
    // correctly reaches 5, which only a one-based count can do. Read as
    // zero-based, every caption but the broken group's would land one
    // photograph later than the one it was written about.
    const five = ["q0", "q1", "q2", "q3", "q4"];
    const pages = planFromIndexes(five, [
      { photos: [1, 2], caption: "First" },
      { photos: [0], caption: "A stray zero" },
      { photos: [3, 4], caption: "Middle" },
      { photos: [5], caption: "Last" },
    ]);

    expect(pages).toEqual([
      { photos: ["q0", "q1"], caption: "First", captionFor: ["q0", "q1"] },
      { photos: ["q2", "q3"], caption: "Middle", captionFor: ["q2", "q3"] },
      { photos: ["q4"], caption: "Last", captionFor: ["q4"] },
    ]);
  });
});
