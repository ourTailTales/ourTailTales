import { describe, expect, it } from "vitest";

import { VIDEO_MEMORY_MAX_PROCESSED_BYTES } from "@/lib/video-memory/config";
import {
  assertProcessedContract,
  canEnterPermanentArchival,
} from "@/lib/video-memory/processing/contract";
import type { ProcessedVideoResult } from "@/lib/video-memory/processing/types";

const ok: ProcessedVideoResult = {
  processedPath: "drafts/x/videos/y/processed.mp4",
  processedBytes: 28 * 1024 * 1024,
  durationMs: 45_000,
  width: 1920,
  height: 1080,
  sha256: "abc",
  videoCodec: "h264",
  audioCodec: "aac",
};

describe("processed contract", () => {
  it("accepts a normalized 1080p clip under 40 MB", () => {
    expect(() => assertProcessedContract(ok)).not.toThrow();
    expect(canEnterPermanentArchival(ok.processedBytes)).toBe(true);
  });

  it("rejects oversized permanent output", () => {
    expect(
      canEnterPermanentArchival(VIDEO_MEMORY_MAX_PROCESSED_BYTES + 1),
    ).toBe(false);
    expect(() =>
      assertProcessedContract({
        ...ok,
        processedBytes: VIDEO_MEMORY_MAX_PROCESSED_BYTES + 1,
      }),
    ).toThrow(/budget/);
  });
});
