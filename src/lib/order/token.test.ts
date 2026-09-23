import { beforeEach, describe, expect, it } from "vitest";

import {
  mintOrderToken,
  orderTokenFromRequest,
  orderTokenValid,
  requireOrderToken,
} from "@/lib/order/token";

const ORDER = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";

beforeEach(() => {
  process.env.ORDER_TOKEN_SECRET = "test-signing-key";
});

describe("order tokens", () => {
  it("is stable for one order", () => {
    expect(mintOrderToken(ORDER)).toBe(mintOrderToken(ORDER));
  });

  it("does not let one order's token open another", () => {
    expect(orderTokenValid(OTHER, mintOrderToken(ORDER))).toBe(false);
  });

  it("accepts the order's own token", () => {
    expect(orderTokenValid(ORDER, mintOrderToken(ORDER))).toBe(true);
  });

  it("refuses a missing, empty or truncated token", () => {
    const real = mintOrderToken(ORDER);
    expect(orderTokenValid(ORDER, null)).toBe(false);
    expect(orderTokenValid(ORDER, "")).toBe(false);
    expect(orderTokenValid(ORDER, real.slice(0, -2))).toBe(false);
  });

  it("refuses a token that is not hex rather than throwing", () => {
    expect(orderTokenValid(ORDER, "zzzz not hex at all")).toBe(false);
  });

  it("changes completely when the signing key rotates", () => {
    const before = mintOrderToken(ORDER);
    process.env.ORDER_TOKEN_SECRET = "a different key";
    expect(mintOrderToken(ORDER)).not.toBe(before);
    expect(orderTokenValid(ORDER, before)).toBe(false);
  });

  it("reads the token off the request header", () => {
    const request = new Request("https://ourtailtales.com/api/orders", {
      headers: { "x-order-token": "  abc  " },
    });
    expect(orderTokenFromRequest(request)).toBe("abc");
    expect(orderTokenFromRequest(new Request("https://ourtailtales.com"))).toBeNull();
  });

  it("answers a bad token exactly as it answers an unknown order", async () => {
    const refused = requireOrderToken(
      new Request("https://ourtailtales.com", {
        headers: { "x-order-token": mintOrderToken(OTHER) },
      }),
      ORDER,
    );
    expect(refused?.status).toBe(404);
    expect(await refused?.json()).toEqual({ error: "Unknown order." });
  });

  it("lets a request through when the token matches", () => {
    expect(
      requireOrderToken(
        new Request("https://ourtailtales.com", {
          headers: { "x-order-token": mintOrderToken(ORDER) },
        }),
        ORDER,
      ),
    ).toBeNull();
  });
});
