import { describe, expect, it } from "vitest";

import { nextBookStep } from "@/lib/book/progress";
import { MIN_PHOTOS_FOR_BOOK } from "@/lib/pricing";

const enough = MIN_PHOTOS_FOR_BOOK;

describe("nextBookStep", () => {
  it("groups the album into chapters once enough photos have arrived", () => {
    expect(
      nextBookStep({
        funnelState: "album_ready",
        chapterCount: 0,
        unwritten: 0,
        mediaCount: enough,
      }),
    ).toBe("build");
  });

  it("asks for more photos rather than building a book out of a handful", () => {
    expect(
      nextBookStep({
        funnelState: "album_ready",
        chapterCount: 0,
        unwritten: 0,
        mediaCount: enough - 1,
      }),
    ).toBe("needPhotos");
  });

  it("writes the chapters once they exist", () => {
    expect(
      nextBookStep({
        funnelState: "organizing",
        chapterCount: 5,
        unwritten: 5,
        mediaCount: enough,
      }),
    ).toBe("write");
  });

  it("recovers a draft that was saved halfway through being written", () => {
    // The case that stranded real books: chapters already built, state still
    // recorded as `album_ready` because that is all the local draft stores.
    expect(
      nextBookStep({
        funnelState: "album_ready",
        chapterCount: 5,
        unwritten: 3,
        mediaCount: enough,
      }),
    ).toBe("write");
  });

  it("opens a book whose chapters are all written but was never marked as such", () => {
    expect(
      nextBookStep({
        funnelState: "album_ready",
        chapterCount: 5,
        unwritten: 0,
        mediaCount: enough,
      }),
    ).toBe("open");
  });

  it("retries the chapters that failed rather than treating the book as done", () => {
    expect(
      nextBookStep({
        funnelState: "album_ready",
        chapterCount: 5,
        unwritten: 1,
        mediaCount: enough,
      }),
    ).toBe("write");
  });

  it("stays out of the way while other work is in flight", () => {
    for (const funnelState of ["processing", "ai_generating"] as const) {
      expect(
        nextBookStep({
          funnelState,
          chapterCount: 5,
          unwritten: 5,
          mediaCount: enough,
        }),
      ).toBe("wait");
    }
  });

  it("does nothing to a book that is already open", () => {
    for (const funnelState of ["editing", "exporting"] as const) {
      expect(
        nextBookStep({
          funnelState,
          chapterCount: 5,
          unwritten: 0,
          mediaCount: enough,
        }),
      ).toBe("wait");
    }
  });

  it("waits at idle, where there is nothing to act on yet", () => {
    expect(
      nextBookStep({
        funnelState: "idle",
        chapterCount: 0,
        unwritten: 0,
        mediaCount: 0,
      }),
    ).toBe("wait");
  });
});
