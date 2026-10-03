import { describe, expect, it } from "vitest";

import {
  DRAFT_TTL_DAYS,
  daysUntilExpiry,
  formatExpiryDate,
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

describe("formatExpiryDate", () => {
  it("prints the absolute date in UTC", () => {
    expect(formatExpiryDate(new Date("2026-10-24T01:00:00Z"))).toBe(
      "October 24, 2026",
    );
  });
});

describe("previewExpiryFrom", () => {
  it("is DRAFT_TTL_DAYS after the start", () => {
    const start = new Date("2026-09-24T12:00:00Z");
    expect(daysUntilExpiry(previewExpiryFrom(start), start)).toBe(DRAFT_TTL_DAYS);
  });
});
