import { afterEach, describe, expect, it, vi } from "vitest";

import {
  captureServerEvent,
  captureServerException,
  getPostHogClient,
} from "@/lib/posthog-server";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

function withMissingPostHogConfigInDevelopment(): void {
  vi.stubEnv("NODE_ENV", "development");
  vi.stubEnv("NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN", "");
  vi.stubEnv("NEXT_PUBLIC_POSTHOG_HOST", "");
}

describe("a missing PostHog token in development", () => {
  it("warns rather than throwing", () => {
    withMissingPostHogConfigInDevelopment();
    const warned = vi.spyOn(console, "error").mockImplementation(() => {});

    expect(() => getPostHogClient()).not.toThrow();
    expect(getPostHogClient()).toBeNull();
    expect(warned).toHaveBeenCalled();
  });

  /**
   * This is the regression: a webhook that marks an order paid and then
   * records an analytics event must finish regardless of whether analytics
   * is configured. It used to throw here, which stranded an already-charged
   * order between "paid" and ever reaching the printer.
   */
  it("lets captureServerEvent resolve instead of aborting its caller", async () => {
    withMissingPostHogConfigInDevelopment();
    vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(
      captureServerEvent("order-1", "order_completed", { revenue: 49.99 }),
    ).resolves.toBeUndefined();
  });

  it("lets captureServerException resolve instead of aborting its caller", async () => {
    withMissingPostHogConfigInDevelopment();
    vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(
      captureServerException(new Error("boom"), "order-1"),
    ).resolves.toBeUndefined();
  });
});
