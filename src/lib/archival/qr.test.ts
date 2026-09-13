import { describe, expect, it } from "vitest";

import { validateQrPlacement } from "@/lib/archival/qr";
import { defaultVideoMemoryBox } from "@/lib/video-memory/geometry";

describe("QR validation gate", () => {
  it("accepts the default Video Memory box", () => {
    expect(() => validateQrPlacement(defaultVideoMemoryBox())).not.toThrow();
  });

  it("rejects a box below the print minimum", () => {
    expect(() =>
      validateQrPlacement({ x: 0.8, y: 0.8, width: 0.05, height: 0.05 }),
    ).toThrow(/qr_below_min_size/);
  });

  it("rejects a box that leaves the page", () => {
    expect(() =>
      validateQrPlacement({ x: 0.9, y: 0.9, width: 0.2, height: 0.2 }),
    ).toThrow(/qr_out_of_bounds/);
  });
});
