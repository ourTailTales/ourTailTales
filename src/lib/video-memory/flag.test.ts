import { afterEach, describe, expect, it, vi } from "vitest";

import { videoMemoriesDisabledResponse, videoMemoriesEnabled } from "./flag";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("videoMemoriesEnabled", () => {
  it("is off when unset", () => {
    vi.stubEnv("VIDEO_MEMORIES_ENABLED", "");
    expect(videoMemoriesEnabled()).toBe(false);
  });

  it("is off for anything but the exact string true", () => {
    for (const value of ["1", "TRUE", "yes", "false", " true"]) {
      vi.stubEnv("VIDEO_MEMORIES_ENABLED", value);
      expect(videoMemoriesEnabled()).toBe(false);
    }
  });

  it("is on for true", () => {
    vi.stubEnv("VIDEO_MEMORIES_ENABLED", "true");
    expect(videoMemoriesEnabled()).toBe(true);
    expect(videoMemoriesDisabledResponse()).toBeNull();
  });

  it("answers 404 Not found while off", async () => {
    vi.stubEnv("VIDEO_MEMORIES_ENABLED", "");
    const response = videoMemoriesDisabledResponse();
    expect(response?.status).toBe(404);
    expect(await response?.json()).toEqual({ error: "Not found." });
  });
});
