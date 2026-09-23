import { afterEach, describe, expect, it } from "vitest";

import { authorizeCron } from "@/lib/cron/auth";

const withSecret = (secret?: string) =>
  new Request("https://example.com/api/cron/daily", {
    headers: secret ? { authorization: `Bearer ${secret}` } : {},
  });

afterEach(() => {
  delete process.env.CRON_SECRET;
});

describe("authorizeCron", () => {
  it("allows the caller through with the right secret", () => {
    process.env.CRON_SECRET = "s3cret";
    expect(authorizeCron(withSecret("s3cret"))).toBeNull();
  });

  it("rejects a wrong secret", async () => {
    process.env.CRON_SECRET = "s3cret";
    const denied = authorizeCron(withSecret("nope"));
    expect(denied?.status).toBe(401);
  });

  it("rejects a missing header", () => {
    process.env.CRON_SECRET = "s3cret";
    expect(authorizeCron(withSecret())?.status).toBe(401);
  });

  it("is open when no secret is configured, matching the previous behaviour", () => {
    // Local development has no CRON_SECRET; requiring one would make the jobs
    // impossible to exercise by hand.
    expect(authorizeCron(withSecret())).toBeNull();
  });
});
