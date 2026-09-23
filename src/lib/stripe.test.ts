import { afterEach, describe, expect, it, vi } from "vitest";

import {
  assertStripeKeyMatchesEnvironment,
  deploymentEnvironment,
  isLiveKey,
} from "@/lib/stripe";

const TEST_SECRET = "sk_test_abc123";
const LIVE_SECRET = "sk_live_abc123";

afterEach(() => {
  delete process.env.VERCEL_ENV;
  delete process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
  vi.restoreAllMocks();
});

describe("deploymentEnvironment", () => {
  it("follows VERCEL_ENV when Vercel sets it", () => {
    for (const env of ["production", "preview", "development"] as const) {
      process.env.VERCEL_ENV = env;
      expect(deploymentEnvironment()).toBe(env);
    }
  });

  it("is development anywhere that is not a Vercel deployment", () => {
    delete process.env.VERCEL_ENV;
    expect(deploymentEnvironment()).toBe("development");
  });

  it("does not treat a local production build as production", () => {
    // `next build && next start` sets NODE_ENV=production on a laptop. Trusting
    // it would let a live key run there, so VERCEL_ENV is the only signal.
    delete process.env.VERCEL_ENV;
    vi.stubEnv("NODE_ENV", "production");
    expect(deploymentEnvironment()).toBe("development");
  });
});

describe("assertStripeKeyMatchesEnvironment", () => {
  it("allows the live key in production", () => {
    expect(() =>
      assertStripeKeyMatchesEnvironment(LIVE_SECRET, "production"),
    ).not.toThrow();
  });

  it("allows the test key outside production", () => {
    expect(() => assertStripeKeyMatchesEnvironment(TEST_SECRET, "preview")).not.toThrow();
    expect(() => assertStripeKeyMatchesEnvironment(TEST_SECRET, "development")).not.toThrow();
  });

  it("refuses a live key in preview — the case that charges real cards", () => {
    expect(() => assertStripeKeyMatchesEnvironment(LIVE_SECRET, "preview")).toThrow(
      /LIVE secret key .* "preview"/,
    );
  });

  it("refuses a live key in local development", () => {
    expect(() => assertStripeKeyMatchesEnvironment(LIVE_SECRET, "development")).toThrow(
      /LIVE secret key/,
    );
  });

  it("warns but still starts when production is on test keys", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(() =>
      assertStripeKeyMatchesEnvironment(TEST_SECRET, "production"),
    ).not.toThrow();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("TEST keys"));
  });

  it("refuses a mismatched secret/publishable pair", () => {
    process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = "pk_test_xyz";
    expect(() =>
      assertStripeKeyMatchesEnvironment(LIVE_SECRET, "production"),
    ).toThrow(/different modes/);

    process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = "pk_live_xyz";
    expect(() => assertStripeKeyMatchesEnvironment(TEST_SECRET, "preview")).toThrow(
      /different modes/,
    );
  });

  it("accepts a matched pair", () => {
    process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = "pk_live_xyz";
    expect(() =>
      assertStripeKeyMatchesEnvironment(LIVE_SECRET, "production"),
    ).not.toThrow();
  });
});

describe("isLiveKey", () => {
  it("recognises both key types", () => {
    expect(isLiveKey("sk_live_x")).toBe(true);
    expect(isLiveKey("pk_live_x")).toBe(true);
    expect(isLiveKey("sk_test_x")).toBe(false);
    expect(isLiveKey("pk_test_x")).toBe(false);
  });
});
