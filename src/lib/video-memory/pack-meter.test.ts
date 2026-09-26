import { describe, expect, it } from "vitest";

import { packBoundaryCopy, packMeterView } from "@/lib/video-memory/pack-meter";

describe("packMeterView", () => {
  it("hides capacity and price when nothing is placed", () => {
    expect(packMeterView(0)).toEqual({ kind: "empty" });
  });

  it("connects capacity and price once a pack is active", () => {
    const meter = packMeterView(6);
    expect(meter).toMatchObject({
      kind: "active",
      used: 6,
      capacity: 10,
      usedLabel: "6 of 10 used",
      priceLabel: "$9.99",
    });
  });

  it("shows the second pack at 11 unique placements", () => {
    const meter = packMeterView(14);
    expect(meter).toMatchObject({
      kind: "active",
      used: 14,
      capacity: 20,
      usedLabel: "14 of 20 used",
      priceLabel: "$19.98",
    });
  });
});

describe("packBoundaryCopy", () => {
  it("asks to add 10 more at the first pack boundary", () => {
    const copy = packBoundaryCopy(10);
    expect(copy.confirm).toBe("Add 10 More — $9.99");
    expect(copy.body).toContain("up to 20 Video Memories");
  });

  it("offers the first pack rather than claiming one is full", () => {
    const copy = packBoundaryCopy(0);
    expect(copy.title).toBe("Add Video Memories to your book?");
    expect(copy.confirm).toBe("Add Video Memories — $9.99");
    // The nonsense this replaces: "You've used all 0 Video Memories in your
    // current pack", shown to somebody placing their first one.
    expect(copy.body).not.toContain("all 0");
    expect(copy.body).not.toContain("more");
    expect(copy.body).toContain("$9.99");
  });
});
