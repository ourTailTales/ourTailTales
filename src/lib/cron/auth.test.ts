import { afterEach, describe, expect, it } from "vitest";

import { authorizeCron } from "@/lib/cron/auth";

const withSecret = (secret?: string) =>
  new Request("https://example.com/api/cron/daily", {
    headers: secret ? { authorization: `Bearer ${secret}` } : {},
  });

afterEach(() => {
  delete process.env.CRON_SECRET;
  delete process.env.VERCEL_ENV;
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

  it("is open when no secret is configured off a deployment", () => {
    // Local development has no CRON_SECRET; requiring one would make the jobs
    // impossible to exercise by hand.
    delete process.env.VERCEL_ENV;
    expect(authorizeCron(withSecret())).toBeNull();
  });

  it("fails closed on a deployment when the secret is missing", () => {
    // The dangerous case: a variable dropped in Vercel would otherwise leave
    // the expiry sweep publicly callable.
    for (const env of ["production", "preview", "development"]) {
      process.env.VERCEL_ENV = env;
      expect(authorizeCron(withSecret())?.status).toBe(401);
    }
  });
});
