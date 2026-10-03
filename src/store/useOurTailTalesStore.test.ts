import { beforeEach, describe, expect, it } from "vitest";

import {
  advanceBatchProgress,
  beginBatchProgress,
  secondsRemaining,
  useOurTailTalesStore,
} from "@/store/useOurTailTalesStore";

describe("upload batch progress", () => {
  it("starts each additive upload as a fresh batch", () => {
    expect(beginBatchProgress(14, 1_000)).toEqual({
      processed: 0,
      total: 14,
      phase: "reading",
      failed: 0,
      startedAt: 1_000,
    });
  });

  it("counts successful and failed files as completed work", () => {
    const started = beginBatchProgress(5, 1_000);
    const photos = advanceBatchProgress(started, 3);
    const finished = advanceBatchProgress(photos, 2, 1);

    expect(finished).toEqual({
      processed: 5,
      total: 5,
      phase: "reading",
      failed: 1,
      // Carried through, so the rate is measured from when the batch began.
      startedAt: 1_000,
    });
  });

  it("never advances beyond the selected batch", () => {
    expect(advanceBatchProgress(beginBatchProgress(2), 8).processed).toBe(2);
  });
});

describe("how much longer the album has", () => {
  const reading = (processed: number, total: number) => ({
    ...beginBatchProgress(total, 0),
    processed,
  });

  it("says nothing until enough has been read to mean anything", () => {
    // Four photographs in, the rate is whatever the first four happened to
    // cost, which for an album of four thousand is a wild guess.
    expect(secondsRemaining(reading(4, 4000), 1_000)).toBeNull();
  });

  it("measures the rate from what has actually been read", () => {
    // 100 photos in 2 seconds, 3900 to go → about 78 seconds.
    expect(secondsRemaining(reading(100, 4000), 2_000)).toBe(78);
  });

  it("says nothing once there is nothing left", () => {
    expect(secondsRemaining(reading(4000, 4000), 90_000)).toBeNull();
  });

  it("never promises less than a second", () => {
    expect(secondsRemaining(reading(999, 1000), 1_000)).toBe(1);
  });
});

describe("saving a book to the account", () => {
  const store = (): ReturnType<typeof useOurTailTalesStore.getState> =>
    useOurTailTalesStore.getState();

  beforeEach(() => {
    useOurTailTalesStore.setState({
      claim: null,
      claimAttemptedFor: [],
      localDraftId: null,
    });
  });

  it("records the attempt against the book, once", () => {
    store().setLocalDraftId("book-1");
    store().beginClaim("book-1");
    store().beginClaim("book-1");
    expect(store().claim).toEqual({ draftId: "book-1", phase: "saving" });
    expect(store().claimAttemptedFor).toEqual(["book-1"]);
  });

  it("clears the status when the save works, and keeps a failure", () => {
    store().setLocalDraftId("book-1");
    store().beginClaim("book-1");
    store().endClaim("book-1", "claimed");
    expect(store().claim).toBeNull();

    store().beginClaim("book-1");
    store().endClaim("book-1", "failed");
    expect(store().claim).toEqual({ draftId: "book-1", phase: "failed" });
    // Still counted as tried, so it is not tried again in a loop.
    expect(store().claimAttemptedFor).toEqual(["book-1"]);
  });

  it("does not report a failure for a book that is no longer on screen", () => {
    store().setLocalDraftId("book-1");
    store().beginClaim("book-1");
    store().setLocalDraftId("book-2");
    store().endClaim("book-1", "failed");
    expect(store().claim).toBeNull();
  });

  it("leaves another book's status alone", () => {
    store().setLocalDraftId("book-2");
    store().beginClaim("book-2");
    store().endClaim("book-1", "failed");
    expect(store().claim).toEqual({ draftId: "book-2", phase: "saving" });
  });

  it("lets the next book be saved after starting over", () => {
    store().setLocalDraftId("book-1");
    store().beginClaim("book-1");
    store().endClaim("book-1", "failed");

    store().reset();
    expect(store().localDraftId).toBeNull();
    expect(store().claimAttemptedFor).toEqual([]);
    expect(store().claim).toBeNull();
  });

  it("lets a save that is still running finish after starting over", () => {
    store().setLocalDraftId("book-1");
    store().beginClaim("book-1");
    store().reset();
    expect(store().claim).toEqual({ draftId: "book-1", phase: "saving" });
    store().endClaim("book-1", "abandoned");
    expect(store().claim).toBeNull();
  });
});
