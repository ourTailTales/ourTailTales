import { afterEach, describe, expect, it } from "vitest";

import { resolveSiteUrl } from "@/lib/env";

afterEach(() => {
  delete process.env.NEXT_PUBLIC_SITE_URL;
  delete process.env.VERCEL_BRANCH_URL;
  delete process.env.VERCEL_URL;
});

describe("resolveSiteUrl", () => {
  it("prefers an explicit NEXT_PUBLIC_SITE_URL", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://ourtailtales.com";
    process.env.VERCEL_BRANCH_URL = "branch.vercel.app";
    expect(resolveSiteUrl()).toBe("https://ourtailtales.com");
  });

  it("falls back to the branch alias so a preview links to itself", () => {
    process.env.VERCEL_BRANCH_URL = "ott-git-feature.vercel.app";
    expect(resolveSiteUrl()).toBe("https://ott-git-feature.vercel.app");
  });

  it("falls back to the deployment hostname when there is no branch alias", () => {
    process.env.VERCEL_URL = "ott-abc123.vercel.app";
    expect(resolveSiteUrl()).toBe("https://ott-abc123.vercel.app");
  });

  it("is localhost off Vercel entirely", () => {
    expect(resolveSiteUrl()).toBe("http://localhost:3000");
  });
});
