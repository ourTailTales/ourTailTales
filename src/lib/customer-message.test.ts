import { describe, expect, it } from "vitest";

import { customerMessage } from "@/lib/customer-message";

describe("what a customer is told when something fails", () => {
  const fallback = "Please try again.";

  it("passes on a sentence one of our routes wrote", () => {
    expect(customerMessage(new Error("That address could not be saved."), fallback)).toBe(
      "That address could not be saved.",
    );
  });

  it("hides what the browser says when a request never arrived", () => {
    expect(customerMessage(new TypeError("Failed to fetch"), fallback)).toBe(fallback);
    expect(customerMessage(new Error("Load failed"), fallback)).toBe(fallback);
    expect(customerMessage(new Error("NetworkError when attempting to fetch resource."), fallback)).toBe(fallback);
  });

  it("hides our own plumbing", () => {
    expect(customerMessage(new Error("Request to /api/orders failed (504)."), fallback)).toBe(fallback);
    expect(customerMessage(new Error("Unexpected token < in JSON"), fallback)).toBe(fallback);
  });

  it("falls back for anything that is not an error, or says nothing", () => {
    expect(customerMessage("boom", fallback)).toBe(fallback);
    expect(customerMessage(new Error("  "), fallback)).toBe(fallback);
  });
});
