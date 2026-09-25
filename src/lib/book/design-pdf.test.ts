import { describe, expect, it } from "vitest";

import { fitToWidth } from "@/lib/book/design-pdf";

/** A face `perEm` wide per character at a given size. */
const face = (characters: number, perEm: number) => (size: number) => characters * perEm * size;

describe("setting a line that the embedded face draws wider than it was measured", () => {
  it("leaves a line that already fits alone", () => {
    expect(fitToWidth(14, 200, face(10, 0.5))).toBe(14);
  });

  it("steps a line down until it is inside its box", () => {
    // Times is about a fifth wider than Cormorant: 20 characters at 14pt
    // measure 168pt in the book's face and 200pt in the fallback.
    const fitted = fitToWidth(14, 168, face(20, 0.714));
    expect(fitted).toBeLessThan(14);
    expect(face(20, 0.714)(fitted)).toBeLessThanOrEqual(168 + 1e-6);
  });

  it("stops rather than shrinking a line away to nothing", () => {
    expect(fitToWidth(14, 1, face(40, 0.6))).toBeGreaterThan(0);
  });
});
