import { describe, expect, it } from "vitest";

import { US_STATE_CODES, stateCode } from "@/components/checkout/us-states";

describe("reading the state field", () => {
  it("accepts a two-letter code in any case", () => {
    expect(stateCode("TX")).toBe("TX");
    expect(stateCode("tx")).toBe("TX");
    expect(stateCode(" ca ")).toBe("CA");
  });

  it("maps a full name to its code", () => {
    expect(stateCode("Texas")).toBe("TX");
    expect(stateCode("new york")).toBe("NY");
    expect(stateCode("  North  Carolina ")).toBe("NC");
    expect(stateCode("WEST VIRGINIA")).toBe("WV");
  });

  it("does not turn an autofilled Arizona into Arkansas", () => {
    expect(stateCode("Arizona")).toBe("AZ");
    expect(stateCode("Arkansas")).toBe("AR");
  });

  it("tells apart the names that start alike", () => {
    expect(stateCode("Mississippi")).toBe("MS");
    expect(stateCode("Missouri")).toBe("MO");
    expect(stateCode("Michigan")).toBe("MI");
    expect(stateCode("Minnesota")).toBe("MN");
    expect(stateCode("Virginia")).toBe("VA");
    expect(stateCode("Washington")).toBe("WA");
  });

  it("knows the District of Columbia by its usual names", () => {
    expect(stateCode("DC")).toBe("DC");
    expect(stateCode("D.C.")).toBe("DC");
    expect(stateCode("District of Columbia")).toBe("DC");
    expect(stateCode("Washington, D.C.")).toBe("DC");
  });

  it("refuses territories and military codes", () => {
    for (const code of ["PR", "VI", "GU", "AS", "MP", "AA", "AE", "AP"]) {
      expect(stateCode(code)).toBeNull();
      expect(US_STATE_CODES.has(code)).toBe(false);
    }
    expect(stateCode("Puerto Rico")).toBeNull();
    expect(stateCode("Guam")).toBeNull();
  });

  it("refuses anything else", () => {
    expect(stateCode("")).toBeNull();
    expect(stateCode("   ")).toBeNull();
    expect(stateCode("XX")).toBeNull();
    expect(stateCode("Ariz")).toBeNull();
    expect(stateCode("Ontario")).toBeNull();
  });

  it("covers the fifty states and DC, and nothing more", () => {
    expect(US_STATE_CODES.size).toBe(51);
  });
});
