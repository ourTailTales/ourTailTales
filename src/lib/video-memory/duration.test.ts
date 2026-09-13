import { describe, expect, it } from "vitest";

import {
  VIDEO_MEMORY_MAX_PROCESSED_BYTES,
  videoMemoryMaxSourceBytes,
} from "@/lib/video-memory/config";
import {
  isAcceptableProcessedBytes,
  isAcceptableVideoDuration,
} from "@/lib/video-memory/duration";

describe("video duration", () => {
  it("accepts 59.9s and 60s", () => {
    expect(isAcceptableVideoDuration(59_900)).toBe(true);
    expect(isAcceptableVideoDuration(60_000)).toBe(true);
  });

  it("rejects longer than 60s", () => {
    expect(isAcceptableVideoDuration(60_001)).toBe(false);
  });
});

describe("processed vs source limits", () => {
  it("keeps the 40 MB permanent budget when source max changes", () => {
    const previous = process.env.VIDEO_MEMORY_MAX_SOURCE_BYTES;
    process.env.VIDEO_MEMORY_MAX_SOURCE_BYTES = String(1024 * 1024 * 1024);
    expect(videoMemoryMaxSourceBytes()).toBe(1024 * 1024 * 1024);
    expect(isAcceptableProcessedBytes(40 * 1024 * 1024, VIDEO_MEMORY_MAX_PROCESSED_BYTES)).toBe(
      true,
    );
    expect(
      isAcceptableProcessedBytes(40 * 1024 * 1024 + 1, VIDEO_MEMORY_MAX_PROCESSED_BYTES),
    ).toBe(false);
    if (previous === undefined) delete process.env.VIDEO_MEMORY_MAX_SOURCE_BYTES;
    else process.env.VIDEO_MEMORY_MAX_SOURCE_BYTES = previous;
  });
});
