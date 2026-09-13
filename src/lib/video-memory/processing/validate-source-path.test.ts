import { describe, expect, it } from "vitest";

import {
  assertPrivateVideoSourcePath,
  isPrivateVideoSourcePath,
} from "@/lib/video-memory/processing/validate-source-path";

const valid =
  "drafts/3d8bbc1c-1a09-9d96-7af0-aaaaaaaaaaaa/videos/3d8bbc1c-1a09-9d96-7af0-bbbbbbbbbbbb/original.mp4";

describe("private source paths", () => {
  it("accepts a draft-scoped object path", () => {
    expect(assertPrivateVideoSourcePath(valid)).toBe(valid);
  });

  it("rejects customer-controlled URLs", () => {
    expect(isPrivateVideoSourcePath("https://evil.example/video.mp4")).toBe(false);
    expect(isPrivateVideoSourcePath("http://169.254.169.254/latest/meta-data")).toBe(
      false,
    );
    expect(isPrivateVideoSourcePath("/etc/passwd")).toBe(false);
    expect(isPrivateVideoSourcePath("drafts/../orders/secret/original.mp4")).toBe(
      false,
    );
  });
});
