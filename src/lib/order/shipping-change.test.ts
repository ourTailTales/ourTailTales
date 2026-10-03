import { describe, expect, it } from "vitest";

import { shippingDetailsChanged } from "@/lib/order/shipping-change";

const address = {
  name: "Sam Rivera",
  phone: "415-555-0134",
  street1: "12 Oak Street",
  street2: null,
  city: "Austin",
  state: "TX",
  postcode: "78701",
  country: "US",
};

const saved = { address, level: "MAIL", quantity: 1 };

describe("whether a save changes what the price was quoted on", () => {
  it("is unchanged when the same address comes back", () => {
    expect(shippingDetailsChanged(saved, { address: { ...address } })).toBe(false);
  });

  it("ignores spacing, the case of the state, and an empty second line", () => {
    expect(
      shippingDetailsChanged(saved, {
        address: {
          ...address,
          name: "  Sam Rivera ",
          state: "tx",
          street2: "",
          postcode: "78701 ",
        },
      }),
    ).toBe(false);
    expect(
      shippingDetailsChanged(saved, { address: { ...address, street2: undefined } }),
    ).toBe(false);
  });

  it("notices each part of the address", () => {
    for (const patch of [
      { name: "Alex Rivera" },
      { phone: "415-555-0199" },
      { street1: "14 Oak Street" },
      { street2: "Apt 2" },
      { city: "Dallas" },
      { state: "CA" },
      { postcode: "78702" },
    ]) {
      expect(
        shippingDetailsChanged(saved, { address: { ...address, ...patch } }),
      ).toBe(true);
    }
  });

  it("treats a first address as a change", () => {
    expect(
      shippingDetailsChanged({ address: null, level: null, quantity: 1 }, { address }),
    ).toBe(true);
  });

  it("compares the delivery speed only when one is sent", () => {
    expect(shippingDetailsChanged(saved, { level: "MAIL" })).toBe(false);
    expect(shippingDetailsChanged(saved, { level: "EXPEDITED" })).toBe(true);
    expect(shippingDetailsChanged(saved, {})).toBe(false);
    expect(shippingDetailsChanged({ ...saved, level: "" }, { level: "MAIL" })).toBe(true);
  });

  it("compares the number of copies only when one is sent", () => {
    expect(shippingDetailsChanged(saved, { quantity: 1 })).toBe(false);
    expect(shippingDetailsChanged(saved, { quantity: 2 })).toBe(true);
    expect(shippingDetailsChanged({ ...saved, quantity: null }, { quantity: 1 })).toBe(false);
  });

  it("is unchanged when everything is sent back as it was", () => {
    expect(
      shippingDetailsChanged(saved, { address, level: "MAIL", quantity: 1 }),
    ).toBe(false);
  });
});
