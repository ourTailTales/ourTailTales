import { describe, expect, it } from "vitest";

import { allowedFrom, type MappedLuluStatus } from "@/lib/lulu/transitions";

const ALL: MappedLuluStatus[] = [
  "submitted",
  "production",
  "shipped",
  "delivered",
  "rejected",
  "canceled",
];

describe("which orders a printer event may move", () => {
  it("only ever moves an order forward", () => {
    expect(allowedFrom("submitted")).toEqual(["submitted"]);
    expect(allowedFrom("production")).toEqual(["submitted"]);
    expect(allowedFrom("shipped")).toEqual(["submitted", "production"]);
    expect(allowedFrom("delivered")).toEqual(["submitted", "production", "shipped"]);
  });

  it("cannot send the shipped email twice or move a delivered book back", () => {
    expect(allowedFrom("shipped")).not.toContain("shipped");
    expect(allowedFrom("shipped")).not.toContain("delivered");
    expect(allowedFrom("production")).not.toContain("shipped");
  });

  it("stops a book only while it is still at the printer", () => {
    expect(allowedFrom("rejected")).toEqual(["submitted", "production"]);
    expect(allowedFrom("canceled")).toEqual(["submitted", "production"]);
  });

  it("never lifts a hold, revives a cancelled order, or touches an unpaid one", () => {
    for (const next of ALL) {
      const from = allowedFrom(next);
      expect(from).not.toContain("needs_review");
      expect(from).not.toContain("canceled");
      expect(from).not.toContain("pending_payment");
      expect(from).not.toContain("paid");
    }
  });
});
