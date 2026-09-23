import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { sendTeaserEmail } from "@/lib/email/send";

describe("sendTeaserEmail without an API key", () => {
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
      sendTeaserEmail({
        to: "someone@example.com",
        petName: "Bailey",
        claimUrl: "https://ourtailtales.com/claim/abc?k=secret",
        hiddenChapters: 4,
        hiddenPages: 44,
        pdf: new Uint8Array([1, 2, 3]),
        fileName: "ourtailtales-bailey-first-pages.pdf",
      }),
    ).resolves.toEqual({ sent: false, reason: "not_configured" });
  });
});
