import { describe, expect, it } from "vitest";

import {
  DRAFT_TTL_DAYS,
  daysUntilExpiry,
  expiryHeadline,
  expiryLabel,
  previewExpiryFrom,
} from "@/lib/drafts/expiry";

const now = new Date("2026-09-23T12:00:00Z");

describe("daysUntilExpiry", () => {
  it("rounds part-days up so nothing reads as zero while it still works", () => {
    expect(daysUntilExpiry(new Date("2026-09-23T18:00:00Z"), now)).toBe(1);
    expect(daysUntilExpiry(new Date("2026-09-24T12:00:00Z"), now)).toBe(1);
    expect(daysUntilExpiry(new Date("2026-09-24T13:00:00Z"), now)).toBe(2);
  });

  it("is zero once the moment has passed", () => {
    expect(daysUntilExpiry(new Date("2026-09-23T11:59:00Z"), now)).toBe(0);
    expect(daysUntilExpiry(new Date("2026-08-01T00:00:00Z"), now)).toBe(0);
  });

  it("covers a full 30-day term", () => {
    expect(daysUntilExpiry(new Date("2026-10-23T12:00:00Z"), now)).toBe(30);
  });
});

describe("expiryLabel", () => {
  it("reads naturally at the boundaries", () => {
    expect(expiryLabel(new Date("2026-09-23T11:00:00Z"), now)).toBe("Expires today");
    expect(expiryLabel(new Date("2026-09-24T06:00:00Z"), now)).toBe("Expires tomorrow");
    expect(expiryLabel(new Date("2026-10-23T12:00:00Z"), now)).toBe("Expires in 30 days");
  });

  it("states the fact without manufacturing urgency", () => {
    const label = expiryLabel(new Date("2026-09-24T06:00:00Z"), now).toLowerCase();
    expect(label).not.toContain("hurry");
    expect(label).not.toContain("last chance");
    expect(label).not.toContain("!");
  });
});

describe("expiryHeadline", () => {
  const now = new Date("2026-09-24T12:00:00Z");

  it("shouts the day count", () => {
    expect(expiryHeadline(new Date("2026-09-29T12:00:00Z"), now)).toBe(
      "EXPIRES IN 5 DAYS",
    );
    expect(expiryHeadline(new Date("2026-09-25T06:00:00Z"), now)).toBe(
      "EXPIRES TOMORROW",
    );
  });
});

describe("previewExpiryFrom", () => {
  it("is DRAFT_TTL_DAYS after the start", () => {
    const start = new Date("2026-09-24T12:00:00Z");
    expect(daysUntilExpiry(previewExpiryFrom(start), start)).toBe(DRAFT_TTL_DAYS);
  });
});
