import { describe, expect, it } from "vitest";

import { LuluError, isMissingPrintJobError, printJobPath } from "@/lib/lulu/client";

describe("telling a lost print job from a failed call", () => {
  const lost = new LuluError("Lulu /print-jobs/123/ failed (404): Not found.", 404, "/print-jobs/123/");

  it("matches a 404 on that order's own print job", () => {
    expect(isMissingPrintJobError(lost, "123")).toBe(true);
    expect(lost.path).toBe(printJobPath("123"));
  });

  it("keeps the message and is still an Error", () => {
    expect(lost).toBeInstanceOf(Error);
    expect(lost.message).toContain("(404)");
    expect(lost.status).toBe(404);
  });

  it("does not match a sign-in failure, whatever its status", () => {
    const auth = new LuluError(
      "Lulu authentication failed (404). Check LULU_CLIENT_KEY and LULU_CLIENT_SECRET.",
      404,
      "/auth/realms/glasstree/protocol/openid-connect/token",
    );
    expect(isMissingPrintJobError(auth, "123")).toBe(false);
  });

  it("does not match a 404 from another call or another job", () => {
    const lookup = new LuluError("nope (404)", 404, "/print-jobs/?external_id=abc");
    expect(isMissingPrintJobError(lookup, "123")).toBe(false);
    expect(isMissingPrintJobError(lost, "1234")).toBe(false);
    expect(isMissingPrintJobError(lost, "12")).toBe(false);
  });

  it("does not match other statuses on the same path", () => {
    for (const status of [401, 403, 429, 500, 503]) {
      expect(
        isMissingPrintJobError(new LuluError("x", status, "/print-jobs/123/"), "123"),
      ).toBe(false);
    }
  });

  it("does not match an order with no print job, or an error that only reads like one", () => {
    expect(isMissingPrintJobError(lost, null)).toBe(false);
    expect(isMissingPrintJobError(lost, "")).toBe(false);
    expect(
      isMissingPrintJobError(new Error("Lulu /print-jobs/123/ failed (404)"), "123"),
    ).toBe(false);
    expect(isMissingPrintJobError("(404)", "123")).toBe(false);
  });
});
