import { describe, expect, it } from "vitest";

import {
  advanceBatchProgress,
  beginBatchProgress,
} from "@/store/useOurTailTalesStore";

describe("upload batch progress", () => {
  it("starts each additive upload as a fresh batch", () => {
    expect(beginBatchProgress(14)).toEqual({
      processed: 0,
      total: 14,
      phase: "reading",
      failed: 0,
    });
  });

  it("counts successful and failed files as completed work", () => {
    const started = beginBatchProgress(5);
    const photos = advanceBatchProgress(started, 3);
    const finished = advanceBatchProgress(photos, 2, 1);

    expect(finished).toEqual({
      processed: 5,
      total: 5,
      phase: "reading",
      failed: 1,
    });
  });

  it("never advances beyond the selected batch", () => {
    expect(advanceBatchProgress(beginBatchProgress(2), 8).processed).toBe(2);
  });
});
