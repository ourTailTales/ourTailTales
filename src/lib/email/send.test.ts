import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { sendFreePdfEmail } from "@/lib/email/send";

describe("sendFreePdfEmail without an API key", () => {
  const original = process.env.RESEND_API_KEY;

  beforeEach(() => {
    delete process.env.RESEND_API_KEY;
  });

  afterEach(() => {
    if (original === undefined) delete process.env.RESEND_API_KEY;
    else process.env.RESEND_API_KEY = original;
  });

  it("no-ops instead of throwing, so a book is never lost to a missing key", async () => {
    await expect(
      sendFreePdfEmail({
        to: "someone@example.com",
        petName: "Bailey",
        bookUrl: "https://ourtailtales.com/book/abc?k=secret",
      }),
    ).resolves.toEqual({ sent: false, reason: "not_configured" });
  });
});
