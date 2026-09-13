import { describe, expect, it } from "vitest";

import {
  includedUniqueVideoCount,
  includedUniqueVideoIds,
  placementsForAsset,
} from "@/lib/video-memory/count";
import { videoMemoryQuote } from "@/lib/video-memory/pricing";
import type { VideoMemoryPlacement } from "@/types/video-memory";

function placement(videoAssetId: string, pageId: string): VideoMemoryPlacement {
  return {
    id: `${videoAssetId}-${pageId}`,
    type: "video-memory",
    videoAssetId,
    pageId,
    x: 0.6,
    y: 0.7,
    width: 0.2,
    height: 0.2,
  };
}

describe("placement vs delete semantics", () => {
  it("keeps the asset when one of two placements is removed", () => {
    let placements = [placement("rocket", "p10"), placement("rocket", "p30")];
    expect(includedUniqueVideoCount(placements)).toBe(1);
    placements = placements.filter((item) => item.pageId !== "p10");
    expect(placementsForAsset(placements, "rocket")).toHaveLength(1);
    expect(includedUniqueVideoCount(placements)).toBe(1);
  });

  it("drops pack pricing when the last placement is removed", () => {
    let placements = [placement("rocket", "p22")];
    placements = placements.filter((item) => item.pageId !== "p22");
    expect(includedUniqueVideoIds(placements)).toEqual([]);
    expect(videoMemoryQuote(includedUniqueVideoCount(placements)).totalCents).toBe(0);
  });

  it("recalculates packs when unique placed videos are deleted", () => {
    const before = Array.from({ length: 12 }, (_, index) =>
      placement(`v${index}`, `p${index}`),
    );
    expect(videoMemoryQuote(includedUniqueVideoCount(before)).packCount).toBe(2);
    const after = before.filter((item) => !["v0", "v1", "v2"].includes(item.videoAssetId));
    expect(videoMemoryQuote(includedUniqueVideoCount(after)).packCount).toBe(1);
  });

  it("uses only placed videos when many unused uploads exist", () => {
    const placed = Array.from({ length: 8 }, (_, index) =>
      placement(`placed-${index}`, `p${index}`),
    );
    expect(videoMemoryQuote(includedUniqueVideoCount(placed)).packCount).toBe(1);
  });
});
