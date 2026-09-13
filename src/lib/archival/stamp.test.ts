import { describe, expect, it } from "vitest";

import { pageIndexForPlacement, stampPageIndex } from "@/lib/archival/stamp";

describe("stamp page mapping", () => {
  it("uses the frozen pageNumber for ids that are not numeric", () => {
    const index = pageIndexForPlacement(
      { pageId: "page-title" },
      24,
      new Map([
        ["page-title", 1],
        ["page-photos-12", 12],
      ]),
    );
    expect(index).toBe(0);
    expect(
      pageIndexForPlacement(
        { pageId: "page-photos-12" },
        24,
        new Map([["page-photos-12", 12]]),
      ),
    ).toBe(11);
  });

  it("clamps page numbers into the PDF range", () => {
    expect(stampPageIndex(1, 10)).toBe(0);
    expect(stampPageIndex(10, 10)).toBe(9);
    expect(stampPageIndex(99, 10)).toBe(9);
  });
});
