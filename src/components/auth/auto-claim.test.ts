import { describe, expect, it } from "vitest";

import {
  sameAddress,
  shouldAutoClaim,
  type AutoClaimInput,
} from "@/components/auth/auto-claim";

const ready: AutoClaimInput = {
  sessionEmail: "sam@example.com",
  leadEmail: "sam@example.com",
  funnelState: "editing",
  pageCount: 24,
  draftId: "draft-1",
  claimedAt: null,
  attemptedFor: [],
};

describe("shouldAutoClaim", () => {
  it("saves a finished book for the person who made it", () => {
    expect(shouldAutoClaim(ready)).toBe(true);
  });

  it("does nothing while signed out", () => {
    expect(shouldAutoClaim({ ...ready, sessionEmail: null })).toBe(false);
    expect(shouldAutoClaim({ ...ready, sessionEmail: undefined })).toBe(false);
    expect(shouldAutoClaim({ ...ready, sessionEmail: "  " })).toBe(false);
    expect(shouldAutoClaim({ ...ready, sessionEmail: null, leadEmail: null })).toBe(false);
  });

  it("waits for the book to be finished and to have pages", () => {
    for (const funnelState of [
      "idle",
      "processing",
      "album_ready",
      "configure",
      "organizing",
      "ai_generating",
      "exporting",
    ]) {
      expect(shouldAutoClaim({ ...ready, funnelState })).toBe(false);
    }
    expect(shouldAutoClaim({ ...ready, pageCount: 0 })).toBe(false);
  });

  it("goes from no to yes when a book made while signed in is finished", () => {
    const writing = { ...ready, funnelState: "ai_generating", pageCount: 0 };
    expect(shouldAutoClaim(writing)).toBe(false);
    expect(shouldAutoClaim({ ...writing, funnelState: "editing", pageCount: 24 })).toBe(true);
  });

  it("waits for the book to have an id", () => {
    expect(shouldAutoClaim({ ...ready, draftId: null })).toBe(false);
    expect(shouldAutoClaim({ ...ready, draftId: "" })).toBe(false);
  });

  it("leaves a book that is already saved alone", () => {
    expect(shouldAutoClaim({ ...ready, claimedAt: "2026-10-03T00:00:00.000Z" })).toBe(false);
  });

  it("tries once per book, not once per address", () => {
    expect(shouldAutoClaim({ ...ready, attemptedFor: ["draft-1"] })).toBe(false);
    // Start over, same address, new book: a new id, and it is saved.
    expect(
      shouldAutoClaim({ ...ready, draftId: "draft-2", attemptedFor: ["draft-1"] }),
    ).toBe(true);
    // The guard was reset with the book.
    expect(shouldAutoClaim({ ...ready, attemptedFor: [] })).toBe(true);
  });

  it("matches addresses without minding capitals or spaces", () => {
    expect(
      shouldAutoClaim({ ...ready, sessionEmail: "Sam@Example.com", leadEmail: " sam@example.COM " }),
    ).toBe(true);
  });

  it("never files one person's book into another person's account", () => {
    expect(
      shouldAutoClaim({ ...ready, sessionEmail: "a@example.com", leadEmail: "b@example.com" }),
    ).toBe(false);
    expect(
      shouldAutoClaim({ ...ready, sessionEmail: "sam@example.com", leadEmail: "sam@example.co" }),
    ).toBe(false);
    expect(
      shouldAutoClaim({ ...ready, sessionEmail: "sam@example.com", leadEmail: "sam+dog@example.com" }),
    ).toBe(false);
  });

  it("saves a book made with no address for whoever is signed in", () => {
    expect(shouldAutoClaim({ ...ready, leadEmail: null })).toBe(true);
    expect(shouldAutoClaim({ ...ready, leadEmail: undefined })).toBe(true);
    expect(shouldAutoClaim({ ...ready, leadEmail: "   " })).toBe(true);
  });
});

describe("sameAddress", () => {
  it("is never true for two missing addresses", () => {
    expect(sameAddress(null, null)).toBe(false);
    expect(sameAddress("", " ")).toBe(false);
    expect(sameAddress("a@b.co", null)).toBe(false);
    expect(sameAddress("A@b.co ", "a@B.co")).toBe(true);
  });
});
