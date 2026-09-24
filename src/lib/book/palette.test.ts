import { describe, expect, it } from "vitest";

import {
  BRAND_PALETTE,
  contrastRatio,
  parseHex,
  resolvePalette,
  sanitizePalette,
} from "@/lib/book/palette";
import type { BookPaletteOption } from "@/types/story";

const rocket: BookPaletteOption = {
  name: "Red collar, golden coat",
  reason: "Picks up his red collar.",
  paper: "#fbf5ec",
  ink: "#2b1d16",
  accent: "#b3362b",
  tape: ["#f0b9a8", "#f4d6a0", "#cfe0c4", "#e9c7b6"],
  scraps: ["#f6e7d6", "#f3dcd6", "#e6eee0"],
  doodle: "#b3362b",
};

const rgb = (hex: string) => parseHex(hex)!;
const lightness = (hex: string) => {
  const { r, g, b } = rgb(hex);
  return (r + g + b) / 3;
};

describe("sanitizePalette", () => {
  it("keeps a sensible palette close to what was proposed", () => {
    const palette = sanitizePalette(rocket);
    expect(contrastRatio(rgb(palette.ink), rgb(palette.paper))).toBeGreaterThanOrEqual(7);
    expect(contrastRatio(rgb(palette.accent), rgb(palette.paper))).toBeGreaterThanOrEqual(3.2);
    // Still red, not pushed to black.
    const accent = rgb(palette.accent);
    expect(accent.r).toBeGreaterThan(accent.g + 0.2);
  });

  it("fixes a dark paper and a pale ink", () => {
    const palette = sanitizePalette({ ...rocket, paper: "#3a2a20", ink: "#d8c8b8" });
    expect(lightness(palette.paper)).toBeGreaterThan(0.9);
    expect(contrastRatio(rgb(palette.ink), rgb(palette.paper))).toBeGreaterThanOrEqual(7);
  });

  it("tames neon tape and keeps it visible", () => {
    const palette = sanitizePalette({ ...rocket, tape: ["#00ff00", "#ff00ff", "#ffffff", "#000000"] });
    for (const tape of palette.tape) {
      expect(lightness(tape)).toBeGreaterThan(0.55);
      expect(lightness(tape)).toBeLessThan(0.97);
    }
  });

  it("falls back per slot for anything that is not a color", () => {
    const palette = sanitizePalette({ ...rocket, accent: "red", tape: [], scraps: ["nope"] });
    expect(palette.tape).toHaveLength(4);
    expect(palette.scraps).toHaveLength(3);
    expect(parseHex(palette.accent)).not.toBeNull();
  });
});

describe("resolvePalette", () => {
  it("uses the classic colors with no profile, or when the owner asks for them", () => {
    expect(resolvePalette({})).toBe(BRAND_PALETTE);
    expect(
      resolvePalette({
        petProfile: { appearance: "", accessories: [], motifs: [], palettes: [rocket] },
        paletteIndex: -1,
      }),
    ).toBe(BRAND_PALETTE);
  });

  it("uses the chosen pet palette", () => {
    const palette = resolvePalette({
      petProfile: { appearance: "", accessories: [], motifs: [], palettes: [rocket] },
    });
    expect(palette).not.toBe(BRAND_PALETTE);
    expect(palette.tape).toHaveLength(4);
  });
});
