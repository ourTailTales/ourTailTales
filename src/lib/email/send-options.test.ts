import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const sendMock = vi.fn();

vi.mock("@/lib/email/resend", () => ({
  emailFrom: () => "ourTailTales <hello@ourtailtales.com>",
  resendClient: () => ({ emails: { send: sendMock } }),
}));

import {
  REPLY_TO,
  SEND_TIMEOUT_MS,
  sendDigitalPurchaseEmail,
  sendOrderConfirmationEmail,
  sendShippingNotificationEmail,
  sendTeaserEmail,
  withTimeout,
} from "@/lib/email/send";

describe("every transactional send", () => {
  const originalKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  beforeEach(() => {
    sendMock.mockReset();
    sendMock.mockResolvedValue({ data: { id: "mail_1" }, error: null });
    // Order links carry a token signed with a server key.
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-signing-key";
  });

  afterEach(() => {
    if (originalKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    else process.env.SUPABASE_SERVICE_ROLE_KEY = originalKey;
    vi.useRealTimers();
  });

  it("sets a reply address a person reads", async () => {
    const orderId = "5d2c1e0a-1f43-4b0c-9b53-0d6a3c0e7a11";
    await sendOrderConfirmationEmail({
      to: "someone@example.com",
      petName: "Bailey",
      orderId,
      total: "$55.48",
    });
    await sendShippingNotificationEmail({
      to: "someone@example.com",
      petName: "Bailey",
      orderId,
    });
    await sendDigitalPurchaseEmail({
      to: "someone@example.com",
      petName: "Bailey",
      bookUrl: "https://ourtailtales.com/book/abc?k=secret",
    });
    await sendTeaserEmail({
      to: "someone@example.com",
      petName: "Bailey",
      claimUrl: "https://ourtailtales.com/claim/abc?k=secret",
      hiddenChapters: 4,
      hiddenPages: 44,
      pdf: new Uint8Array([1, 2, 3]),
      fileName: "sample.pdf",
    });

    expect(REPLY_TO).toBe("hello@ourtailtales.com");
    expect(sendMock).toHaveBeenCalledTimes(4);
    for (const [payload] of sendMock.mock.calls) {
      expect(payload).toMatchObject({ replyTo: "hello@ourtailtales.com" });
    }
  });

  it("gives up on a send that never answers, without throwing", async () => {
    vi.useFakeTimers();
    sendMock.mockReturnValue(new Promise(() => undefined));
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    const result = sendDigitalPurchaseEmail({
      to: "someone@example.com",
      petName: "Bailey",
      bookUrl: "https://ourtailtales.com/book/abc?k=secret",
    });
    await vi.advanceTimersByTimeAsync(SEND_TIMEOUT_MS + 1);

    await expect(result).resolves.toMatchObject({ sent: false });
    vi.restoreAllMocks();
  });
});

describe("withTimeout", () => {
  it("passes a prompt answer through", async () => {
    await expect(withTimeout(Promise.resolve("ok"), 50)).resolves.toBe("ok");
  });

  it("passes a prompt failure through", async () => {
    await expect(withTimeout(Promise.reject(new Error("no")), 50)).rejects.toThrow("no");
  });

  it("rejects when the work takes too long", async () => {
    await expect(withTimeout(new Promise(() => undefined), 10)).rejects.toThrow(
      /timed out/,
    );
  });
});
