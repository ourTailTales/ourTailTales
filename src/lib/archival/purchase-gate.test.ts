import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

function src(relative: string): string {
  return readFileSync(resolve(process.cwd(), relative), "utf8");
}

describe("purchase gate module boundaries", () => {
  it("does not import Turbo from upload or webhook routes", () => {
    const guarded = [
      "src/app/api/videos/authorize/route.ts",
      "src/app/api/videos/complete/route.ts",
      "src/app/api/stripe/webhook/route.ts",
      "src/lib/book/sample-pdf.ts",
      "src/lib/book/interior-pdf.ts",
      "src/lib/video-memory/process-job.ts",
      "src/app/api/cron/process-videos/route.ts",
    ];
    for (const file of guarded) {
      const text = src(file);
      expect(text).not.toMatch(/@ardrive\/turbo-sdk/);
      expect(text).not.toMatch(/lib\/archival\/turbo/);
    }
  });

  it("does not stream source bytes through authorize", () => {
    const text = src("src/app/api/videos/authorize/route.ts");
    expect(text).not.toMatch(/arrayBuffer\(\)/);
    expect(text).not.toMatch(/request\.blob/);
  });
});
