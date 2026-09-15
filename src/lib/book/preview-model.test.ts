import { describe, expect, it } from "vitest";

import {
  currentPageForFocus,
  focusFromCurrentPage,
  lastReadablePage,
  nearbyInteriorIndexes,
  pairInteriorLeaves,
  previewSpreadLabel,
} from "./preview-model";

describe("pairInteriorLeaves", () => {
  it("pairs even interiors into physical leaves", () => {
    expect(pairInteriorLeaves(4, "spread")).toEqual([
      { front: 0, back: 1 },
      { front: 2, back: 3 },
    ]);
  });

  it("leaves a blank verso on an odd last page", () => {
    expect(pairInteriorLeaves(3, "spread")).toEqual([
      { front: 0, back: 1 },
      { front: 2, back: null },
    ]);
  });

  it("puts each page on its own leaf in single mode", () => {
    expect(pairInteriorLeaves(3, "single")).toEqual([
      { front: 0, back: null },
      { front: 1, back: null },
      { front: 2, back: null },
    ]);
  });
});

describe("previewSpreadLabel", () => {
  it("names the closed cover and first open spread", () => {
    expect(
      previewSpreadLabel({
        currentPage: 0,
        interiorCount: 4,
        pairing: "spread",
        closed: true,
      }),
    ).toBe("Cover");
    expect(
      previewSpreadLabel({
        currentPage: 1,
        interiorCount: 4,
        pairing: "spread",
        closed: false,
      }),
    ).toBe("Inside cover · 1");
  });

  it("names a later spread and the back cover", () => {
    expect(
      previewSpreadLabel({
        currentPage: 3,
        interiorCount: 4,
        pairing: "spread",
        closed: false,
      }),
    ).toBe("2 · 3");
    expect(
      previewSpreadLabel({
        currentPage: 5,
        interiorCount: 4,
        pairing: "spread",
        closed: false,
      }),
    ).toBe("4 · Back cover");
  });

  it("names a single-page leaf", () => {
    expect(
      previewSpreadLabel({
        currentPage: 3,
        interiorCount: 4,
        pairing: "single",
        closed: false,
      }),
    ).toBe("Page 2 of 4");
  });
});

describe("page mapping", () => {
  it("maps focus to currentPage and back", () => {
    expect(currentPageForFocus(0, "spread")).toBe(0);
    expect(currentPageForFocus(1, "spread")).toBe(1);
    expect(currentPageForFocus(2, "spread")).toBe(3);
    expect(currentPageForFocus(3, "spread")).toBe(3);
    expect(currentPageForFocus(2, "single")).toBe(3);
    expect(focusFromCurrentPage(3, "spread", false)).toBe(2);
    expect(focusFromCurrentPage(3, "single", false)).toBe(2);
  });

  it("stops before the reverse of the back board", () => {
    // cover(2) + two leaves(4) + back(2) = 8 faces
    expect(lastReadablePage(8)).toBe(5);
  });

  it("preloads nearby interiors", () => {
    expect(nearbyInteriorIndexes(3, 6, "spread")).toEqual([0, 1, 2, 3]);
  });
});
