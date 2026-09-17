import { describe, expect, it } from "vitest";

import { buildStoryPrompt } from "@/lib/ai/prompt";

describe("buildStoryPrompt", () => {
  it("keeps pre-signup stories anonymous without inventing a pet name", () => {
    const prompt = buildStoryPrompt({
      petName: "",
      lifespan: "",
      dateLabel: "2019–2020",
      photoCount: 12,
      selectedCount: 8,
      places: [],
      seasons: ["spring", "summer"],
      thumbnails: [],
    });

    expect(prompt).toContain("name has not been collected yet");
    expect(prompt).toContain("Never invent or assign one");
    expect(prompt).not.toContain("Pet name: unnamed");
  });
});
