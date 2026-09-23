import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { loadStoredDraft, storeDraft } from "@/lib/video-memory/client";

/** Enough of localStorage for these functions, on a node runner. */
function installStorage(): Map<string, string> {
  const data = new Map<string, string>();
  const storage = {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    removeItem: (key: string) => void data.delete(key),
  };
  (globalThis as { window?: unknown }).window = { localStorage: storage };
  return data;
}

const alice = { draftId: "draft-alice", secret: "secret-alice" };
const bob = { draftId: "draft-bob", secret: "secret-bob" };

describe("draft credentials are bucketed by email", () => {
  let data: Map<string, string>;

  beforeEach(() => {
    data = installStorage();
  });

  afterEach(() => {
    delete (globalThis as { window?: unknown }).window;
  });

  it("keeps two addresses on two different books", () => {
    storeDraft(alice, "alice@example.com");
    storeDraft(bob, "bob@example.com");

    expect(loadStoredDraft("alice@example.com")).toEqual(alice);
    expect(loadStoredDraft("bob@example.com")).toEqual(bob);
  });

  it("does not hand one address another's draft", () => {
    storeDraft(alice, "alice@example.com");
    expect(loadStoredDraft("bob@example.com")).toBeNull();
  });

  it("ignores case and surrounding space in an address", () => {
    storeDraft(alice, "alice@example.com");
    expect(loadStoredDraft("  ALICE@Example.com ")).toEqual(alice);
  });

  it("keeps an anonymous draft apart from every named one", () => {
    storeDraft(alice, null);
    expect(loadStoredDraft(null)).toEqual(alice);
    expect(loadStoredDraft("alice@example.com")).toBeNull();
  });

  it("moves a pre-bucketing draft into the anonymous slot rather than losing it", () => {
    data.set("ourtailtales.draft", JSON.stringify(alice));

    expect(loadStoredDraft(null)).toEqual(alice);
    expect(data.has("ourtailtales.draft")).toBe(false);
  });

  it("never lets a migrated draft overwrite one already in the anonymous slot", () => {
    storeDraft(bob, null);
    data.set("ourtailtales.draft", JSON.stringify(alice));

    expect(loadStoredDraft(null)).toEqual(bob);
  });

  it("treats a malformed record as no draft at all", () => {
    data.set("ourtailtales.draft:anon", "{oh no");
    expect(loadStoredDraft(null)).toBeNull();
  });
});
