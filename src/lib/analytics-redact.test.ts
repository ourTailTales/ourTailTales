import { describe, expect, it } from "vitest";

import { redactProperties, redactUrl } from "@/lib/analytics-redact";

describe("redactUrl", () => {
  it("strips the draft secret from an absolute book URL", () => {
    expect(
      redactUrl("https://ourtailtales.com/book/abc-123?k=supersecret"),
    ).toBe("https://ourtailtales.com/book/abc-123?k=redacted");
  });

  it("keeps other parameters intact", () => {
    const out = redactUrl(
      "https://ourtailtales.com/book/abc?k=secret&purchased=true",
    );
    expect(out).toContain("purchased=true");
    expect(out).not.toContain("secret");
  });

  it("handles relative paths without inventing an origin", () => {
    expect(redactUrl("/book/abc?k=secret")).toBe("/book/abc?k=redacted");
  });

  it("leaves untouched anything with no secret in it", () => {
    const plain = "https://ourtailtales.com/create";
    expect(redactUrl(plain)).toBe(plain);
  });

  it("strips the order token from a checkout URL", () => {
    expect(
      redactUrl("https://ourtailtales.com/checkout?order=abc-123&t=ordertoken"),
    ).toBe("https://ourtailtales.com/checkout?order=abc-123&t=redacted");
  });
});

describe("redactProperties", () => {
  it("scrubs every URL-bearing property, not just $current_url", () => {
    const out = redactProperties({
      $current_url: "https://ourtailtales.com/book/a?k=secret",
      $referrer: "https://ourtailtales.com/book/a?k=secret",
      $initial_current_url: "https://ourtailtales.com/book/a?k=secret",
      chapters: 5,
    });

    expect(JSON.stringify(out)).not.toContain("secret");
    expect(out.chapters).toBe(5);
  });

  it("does not disturb non-string values", () => {
    const out = redactProperties({ chapters: 5, ok: true, missing: null });
    expect(out).toEqual({ chapters: 5, ok: true, missing: null });
  });

  it("catches the order token even with no draft secret present", () => {
    const out = redactProperties({
      $current_url: "https://ourtailtales.com/checkout?order=abc&t=ordertoken",
    });
    expect(JSON.stringify(out)).not.toContain("ordertoken");
  });
});
