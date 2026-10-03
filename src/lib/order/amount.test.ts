import { describe, expect, it } from "vitest";

import { expectedOrderAmount } from "@/lib/order/amount";
import { copiesTotal, extraCopyPrice } from "@/lib/pricing";

describe("what an order should have been charged", () => {
  it("adds one book and its shipping, in cents", () => {
    expect(
      expectedOrderAmount({
        book_price: 49.99,
        quantity: 1,
        video_memory_total_cents: null,
        shipping_price: 5.49,
      }),
    ).toBe(5548);
  });

  it("charges further copies at the discounted price", () => {
    const expected = Math.round(
      (49.99 + 2 * extraCopyPrice(49.99) + 7.25) * 100,
    );
    expect(
      expectedOrderAmount({
        book_price: 49.99,
        quantity: 3,
        video_memory_total_cents: 0,
        shipping_price: 7.25,
      }),
    ).toBe(expected);
    expect(expected).toBe(Math.round((copiesTotal(49.99, 3) + 7.25) * 100));
  });

  it("includes Video Memories", () => {
    expect(
      expectedOrderAmount({
        book_price: 49.99,
        quantity: 1,
        video_memory_total_cents: 999,
        shipping_price: 5,
      }),
    ).toBe(4999 + 999 + 500);
  });

  it("reads the numeric strings the database returns", () => {
    expect(
      expectedOrderAmount({
        book_price: "84.92",
        quantity: 2,
        video_memory_total_cents: null,
        shipping_price: "6.10",
      }),
    ).toBe(Math.round((copiesTotal(84.92, 2) + 6.1) * 100));
  });

  it("treats a missing quantity as one copy and never more than the cap", () => {
    const one = expectedOrderAmount({
      book_price: 49.99,
      quantity: null,
      video_memory_total_cents: null,
      shipping_price: 0,
    });
    expect(one).toBe(4999);
    expect(
      expectedOrderAmount({
        book_price: 49.99,
        quantity: 99,
        video_memory_total_cents: null,
        shipping_price: 0,
      }),
    ).toBe(Math.round(copiesTotal(49.99, 5) * 100));
  });

  it("has no answer while the shipping price is unlocked", () => {
    expect(
      expectedOrderAmount({
        book_price: 49.99,
        quantity: 1,
        video_memory_total_cents: null,
        shipping_price: null,
      }),
    ).toBeNull();
  });

  it("counts free shipping as a locked price of zero", () => {
    expect(
      expectedOrderAmount({
        book_price: 49.99,
        quantity: 1,
        video_memory_total_cents: null,
        shipping_price: 0,
      }),
    ).toBe(4999);
  });
});
