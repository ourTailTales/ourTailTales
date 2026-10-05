import { describe, expect, it } from "vitest";

import { printFileVerdict } from "@/lib/order/print-file-check";

describe("checking a print file against what was paid for", () => {
  it("passes a file of exactly the ordered length", () => {
    expect(printFileVerdict(54, 54)).toEqual({ ok: true, pages: 54 });
  });

  it("refuses a file longer than the order paid for", () => {
    const verdict = printFileVerdict(504, 54);
    expect(verdict.ok).toBe(false);
    expect(verdict.pages).toBe(504);
  });

  it("refuses a file that is one page over", () => {
    expect(printFileVerdict(55, 54).ok).toBe(false);
  });

  it("refuses a file that could not be read", () => {
    expect(printFileVerdict(null, 54).ok).toBe(false);
    expect(printFileVerdict(0, 54).ok).toBe(false);
  });

  it("refuses when the order has no page count", () => {
    expect(printFileVerdict(54, null).ok).toBe(false);
    expect(printFileVerdict(54, 0).ok).toBe(false);
  });

  it("leaves a shorter file to the printer's own check", () => {
    expect(printFileVerdict(40, 54).ok).toBe(true);
  });
});
