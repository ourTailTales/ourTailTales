import { describe, expect, it } from "vitest";

import {
  placedMemoriesReadyForCheckout,
  unusedLibraryBlocksCheckout,
} from "@/lib/video-memory/checkout-ready";

describe("checkout readiness", () => {
  it("never lets unused library videos block checkout", () => {
    expect(unusedLibraryBlocksCheckout()).toBe(false);
    expect(
      placedMemoriesReadyForCheckout(
        [],
        [
          { id: "processing", status: "processing" },
          { id: "failed", status: "failed" },
        ],
      ),
    ).toBe(true);
  });

  it("requires every placed memory to be ready", () => {
    expect(
      placedMemoriesReadyForCheckout(
        [{ videoAssetId: "a" }, { videoAssetId: "a" }],
        [
          { id: "a", status: "ready" },
          { id: "b", status: "processing" },
        ],
      ),
    ).toBe(true);
    expect(
      placedMemoriesReadyForCheckout(
        [{ videoAssetId: "a" }],
        [{ id: "a", status: "processing" }],
      ),
    ).toBe(false);
  });

  it("treats a photo-only book as ready", () => {
    expect(placedMemoriesReadyForCheckout([], [])).toBe(true);
  });
});
