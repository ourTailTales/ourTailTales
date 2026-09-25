import { describe, expect, it } from "vitest";

import {
  COVER_LAYOUTS,
  DEFAULT_COVER_LAYOUT,
  coverLayoutSpec,
  coverLayoutUnlocked,
  coverTextTone,
  coverUsesPhoto,
  defaultNameAnchor,
  isCoverLayoutId,
} from "@/lib/book/coverLayouts";
import type { CoverLayoutId } from "@/types/book";

describe("the cover styles", () => {
  it("offers six, two of them with no photograph at all", () => {
    expect(COVER_LAYOUTS).toHaveLength(6);
    expect(COVER_LAYOUTS.filter((layout) => !layout.usesPhoto).map((layout) => layout.id)).toEqual([
      "keepsake",
      "monogram",
    ]);
    for (const layout of COVER_LAYOUTS) {
      expect(layout.label).toBeTruthy();
      expect(layout.description).toBeTruthy();
      expect(coverUsesPhoto(layout.id)).toBe(layout.usesPhoto);
    }
  });

  it("gives away exactly one, and locks the rest behind an account", () => {
    const free = COVER_LAYOUTS.filter((layout) => layout.free);
    expect(free.map((layout) => layout.id)).toEqual([DEFAULT_COVER_LAYOUT]);

    for (const layout of COVER_LAYOUTS) {
      // Signed in, everything is available; signed out, only the free one is.
      expect(coverLayoutUnlocked(layout.id, true)).toBe(true);
      expect(coverLayoutUnlocked(layout.id, false)).toBe(layout.free);
    }
  });

  it("sets the name in ink wherever it lands on paper rather than on a photo", () => {
    for (const layout of COVER_LAYOUTS) {
      expect(defaultNameAnchor(layout.id)).toMatch(/^(top|middle|bottom)-(left|center|right)$/);
      if (!layout.usesPhoto) expect(coverTextTone(layout.id)).toBe("dark");
    }
    expect(coverTextTone("classic")).toBe("light");
    // The framed portrait's name sits on the paper below the picture.
    expect(coverTextTone("portrait")).toBe("dark");
  });

  it("falls back to the classic cover for anything it does not know", () => {
    expect(isCoverLayoutId("keepsake")).toBe(true);
    expect(isCoverLayoutId("nonsense")).toBe(false);
    expect(coverLayoutSpec("nonsense" as CoverLayoutId).id).toBe(DEFAULT_COVER_LAYOUT);
  });
});
