import { describe, expect, it } from "vitest";

import { includedUniqueVideoCount } from "@/lib/video-memory/count";
import { VIDEO_MEMORY_PACK_PRICE_CENTS } from "@/lib/video-memory/config";
import { videoMemoryQuote, wouldOpenNewPack } from "@/lib/video-memory/pricing";

describe("videoMemoryQuote", () => {
  const cases: [number, number][] = [
    [0, 0],
    [1, 1],
    [10, 1],
    [11, 2],
    [20, 2],
    [21, 3],
    [100, 10],
    [200, 20],
  ];

  it.each(cases)("%i unique placed videos → %i packs", (count, packs) => {
    const quote = videoMemoryQuote(count);
    expect(quote.packCount).toBe(packs);
    expect(quote.totalCents).toBe(packs * VIDEO_MEMORY_PACK_PRICE_CENTS);
  });

  it("does not use an operational asset cap in pack math", () => {
    expect(videoMemoryQuote(200).packCount).toBe(20);
  });
});

describe("unique videos vs placements", () => {
  it("counts one asset with two placements as one paid memory", () => {
    const placements = [
      { videoAssetId: "a" },
      { videoAssetId: "a" },
    ];
    expect(includedUniqueVideoCount(placements)).toBe(1);
    expect(videoMemoryQuote(includedUniqueVideoCount(placements)).totalCents).toBe(
      VIDEO_MEMORY_PACK_PRICE_CENTS,
    );
  });

  it("charges nothing for uploads with zero placements", () => {
    expect(videoMemoryQuote(includedUniqueVideoCount([])).packCount).toBe(0);
  });
});

describe("wouldOpenNewPack", () => {
  it("requires confirmation when placing the 11th unique video", () => {
    expect(wouldOpenNewPack(10, true)).toBe(true);
    expect(wouldOpenNewPack(10, false)).toBe(false);
    expect(wouldOpenNewPack(9, true)).toBe(false);
  });
});
