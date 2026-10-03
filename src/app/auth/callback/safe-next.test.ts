import { describe, expect, it } from "vitest";

import { failedNextPath, safeNextPath } from "@/app/auth/callback/safe-next";

const origin = "https://ourtailtales.example";

describe("safeNextPath", () => {
  it("keeps ordinary paths on this site", () => {
    expect(safeNextPath("/reset-password", origin)).toBe("/reset-password");
    expect(safeNextPath("/create?email=a%2Bb%40example.com", origin)).toBe(
      "/create?email=a%2Bb%40example.com",
    );
    expect(safeNextPath("/claim/abc-123?k=secret", origin)).toBe(
      "/claim/abc-123?k=secret",
    );
  });

  it("falls back when nothing was asked for", () => {
    expect(safeNextPath(null, origin)).toBe("/create");
    expect(safeNextPath("", origin)).toBe("/create");
    expect(safeNextPath("/", origin)).toBe("/create");
  });

  it.each([
    "//evil.com",
    "//evil.com/create",
    "/\\evil.com",
    "/\\/evil.com",
    "\\\\evil.com",
    "/\t/evil.com",
    "/\n/evil.com",
    "/a\\..\\..\\evil.com",
    "https://evil.com",
    "http:evil.com",
    "javascript:alert(1)",
    "evil.com",
    "create",
    " /create",
  ])("refuses %j", (value) => {
    expect(safeNextPath(value, origin)).toBe("/create");
  });

  // Each of these passes a check on the text as written and only becomes
  // `//evil.com` once the URL parser has collapsed the dot segments.
  it.each([
    "/.//evil.com",
    "/..//evil.com",
    "/a/..//evil.com",
    "/%2e%2e//evil.com",
    "/.%2e//evil.com",
    "/claim/..//evil.com",
    "/./\\evil.com",
    "/a/../..//evil.com/create",
    "/%2E//evil.com?x=1#y",
  ])("refuses %j, which resolves to another site", (value) => {
    expect(safeNextPath(value, origin)).toBe("/create");
  });

  it.each([
    ["/create", "/create"],
    ["/create?email=a%40b.co", "/create?email=a%40b.co"],
    ["/create/finish?email=a%2Bb%40example.com", "/create/finish?email=a%2Bb%40example.com"],
    ["/reset-password", "/reset-password"],
    ["/claim/abc-123?k=secret", "/claim/abc-123?k=secret"],
    ["/claim/abc-123?k=secret&mode=signin", "/claim/abc-123?k=secret&mode=signin"],
    ["/book/7f3c", "/book/7f3c"],
    ["/book/7f3c#page-4", "/book/7f3c#page-4"],
    ["/library", "/library"],
    ["/a/b/c/", "/a/b/c/"],
    ["/a/./b", "/a/b"],
    ["/a/b/../c", "/a/c"],
    ["/claim/../create", "/create"],
    ["/a/..", "/"],
    ["/@evil.com/x", "/@evil.com/x"],
    ["/x?next=//evil.com", "/x?next=//evil.com"],
    ["/x#//evil.com", "/x#//evil.com"],
    ["/caf\u00e9", "/caf%C3%A9"],
  ])("keeps %j on this site", (value, expected) => {
    const next = safeNextPath(value, origin);
    expect(next).toBe(expected);
    expect(next).toMatch(/^\/(?:[^/\\]|$)/);
    expect(new URL(next, origin).origin).toBe(origin);
  });

  it("never returns anything a browser reads as another site", () => {
    const pieces = ["/", "//", ".", "..", "%2e", "%2E", "\\", "a", "evil.com", "claim", "?", "#", "@", ":", "\t", " "];
    // A small fixed-seed generator, so a failure names an input that fails again.
    let seed = 20261003;
    const random = (): number => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 0x100000000;
    };
    for (let round = 0; round < 5000; round += 1) {
      const length = 1 + Math.floor(random() * 7);
      let value = "/";
      for (let index = 0; index < length; index += 1) {
        value += pieces[Math.floor(random() * pieces.length)];
      }
      const next = safeNextPath(value, origin);
      const ok =
        /^\/(?:[^/\\]|$)/.test(next) && new URL(next, origin).origin === origin;
      if (!ok) throw new Error(`${JSON.stringify(value)} became ${JSON.stringify(next)}`);
    }
  });

  it("never resolves to another origin", () => {
    const next = safeNextPath("/@evil.com/x", origin);
    expect(new URL(next, origin).origin).toBe(origin);
  });
});

describe("failedNextPath", () => {
  it("sends a claim link back to the claim page, ready to sign in", () => {
    expect(failedNextPath("/claim/abc?k=s", origin)).toBe(
      "/claim/abc?k=s&mode=signin",
    );
  });

  it("keeps the address when the editor was the destination", () => {
    expect(failedNextPath("/create?email=a%40b.co", origin)).toBe(
      "/create?email=a%40b.co&authError=callback",
    );
  });

  it("sends a reset link to the reset page, which says the link did not work", () => {
    expect(failedNextPath("/reset-password", origin)).toBe("/reset-password");
    expect(failedNextPath("/reset-password?x=1#y", origin)).toBe("/reset-password");
  });

  it("uses the editor for anything else", () => {
    expect(failedNextPath("/book/abc", origin)).toBe("/create?authError=callback");
    expect(failedNextPath("/reset-password-other", origin)).toBe(
      "/create?authError=callback",
    );
  });
});
