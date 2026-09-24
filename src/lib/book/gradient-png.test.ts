import { PNG } from "pngjs";
import { describe, expect, it } from "vitest";

import { alphaAt, verticalAlphaRampPng } from "@/lib/book/gradient-png";

const stops = [
  { at: 0, alpha: 0.72 },
  { at: 0.42, alpha: 0.42 },
  { at: 1, alpha: 0 },
];

describe("verticalAlphaRampPng", () => {
  it("encodes a valid PNG that decodes to a smooth ramp", () => {
    const bytes = verticalAlphaRampPng({ r: 0, g: 0, b: 0 }, stops, 64);
    const png = PNG.sync.read(Buffer.from(bytes));
    expect(png.width).toBe(1);
    expect(png.height).toBe(64);

    const alphas = Array.from({ length: 64 }, (_, row) => png.data[row * 4 + 3]!);
    // Top row transparent, bottom row darkest, never getting lighter going down.
    expect(alphas[0]).toBe(0);
    expect(alphas[63]).toBe(Math.round(0.72 * 255));
    for (let row = 1; row < 64; row += 1) {
      expect(alphas[row]!).toBeGreaterThanOrEqual(alphas[row - 1]!);
    }
  });

  it("interpolates between stops", () => {
    expect(alphaAt(stops, 0.21)).toBeCloseTo(0.57, 2);
    expect(alphaAt(stops, 1)).toBe(0);
  });
});
