import { describe, expect, it } from "vitest";

import { shippingFingerprint } from "@/lib/order/shipping-fingerprint";

const address = {
  name: "Sam Doe",
  phone: "5551234567",
  street1: "1 Main St",
  street2: "",
  city: "Dudley",
  state: "ma",
  postcode: "01571",
  country: "US",
};

describe("the digest a locked price is tied to", () => {
  const base = shippingFingerprint({ address, level: "MAIL", quantity: 1 });

  it("is the same for the same details however they are written", () => {
    expect(
      shippingFingerprint({
        address: { ...address, state: "MA", street2: null, city: " Dudley " },
        level: " MAIL ",
        quantity: null,
      }),
    ).toBe(base);
  });

  it("changes with the delivery speed", () => {
    expect(shippingFingerprint({ address, level: "EXPEDITED", quantity: 1 })).not.toBe(base);
  });

  it("changes with the address", () => {
    expect(
      shippingFingerprint({ address: { ...address, postcode: "90210" }, level: "MAIL", quantity: 1 }),
    ).not.toBe(base);
  });

  it("changes with the number of copies", () => {
    expect(shippingFingerprint({ address, level: "MAIL", quantity: 3 })).not.toBe(base);
  });
});
