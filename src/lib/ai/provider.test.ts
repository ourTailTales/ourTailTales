import { describe, expect, it } from "vitest";

import { parsePetProfile } from "@/lib/ai/provider";

const palette = {
  name: "Red collar, golden coat",
  reason: "Picks up his red collar.",
  paper: "#FBF6EE",
  ink: "#2b1d16",
  accent: "a33b2f",
  tape: ["#f2c9a0", "#e8a598", "#c9d8c0", "#f5e0b8"],
  scraps: ["#f7e6d4", "#f3dcd6", "#e6eee0"],
  doodle: "#a33b2f",
};

describe("parsePetProfile", () => {
  it("normalises hex and keeps up to three palettes", () => {
    const profile = parsePetProfile(
      JSON.stringify({
        appearance: " a caramel dog ",
        accessories: [{ item: "collar", color: "red" }],
        motifs: ["tennis ball"],
        palettes: [palette, palette, palette, palette],
      }),
      "test",
    );
    expect(profile.appearance).toBe("a caramel dog");
    expect(profile.palettes).toHaveLength(3);
    expect(profile.palettes[0]!.accent).toBe("#a33b2f");
    expect(profile.palettes[0]!.paper).toBe("#fbf6ee");
  });

  it("drops a broken palette rather than the whole profile", () => {
    const profile = parsePetProfile(
      JSON.stringify({
        appearance: "a grey cat",
        accessories: [],
        motifs: [],
        palettes: [{ ...palette, ink: "dark brown" }, palette],
      }),
      "test",
    );
    expect(profile.palettes).toHaveLength(1);
  });

  it("refuses something that is not JSON", () => {
    expect(() => parsePetProfile("not json", "test")).toThrow();
  });
});
