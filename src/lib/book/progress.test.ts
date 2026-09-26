import { describe, expect, it } from "vitest";

import { nextBookStep } from "@/lib/book/progress";
import { MIN_PHOTOS_FOR_BOOK } from "@/lib/pricing";

const enough = MIN_PHOTOS_FOR_BOOK;

describe("nextBookStep", () => {
  it("asks how long the book should be before building anything", () => {
    // The step between an album and a book: nothing has been written yet,
    // and what follows costs a model call per chapter at a price nobody has
    // agreed to.
    expect(
      nextBookStep({
        funnelState: "album_ready",
        chapterCount: 0,
        unwritten: 0,
        mediaCount: enough,
        photoCount: enough,
        sizeConfirmed: false,
      }),
    ).toBe("size");
  });

  it("starts nothing while the customer is still looking at the price", () => {
    expect(
      nextBookStep({
        funnelState: "configure",
        chapterCount: 0,
        unwritten: 0,
        mediaCount: enough,
        photoCount: enough,
        sizeConfirmed: false,
      }),
    ).toBe("wait");
  });

  it("asks for photos before it asks for a length", () => {
    expect(
      nextBookStep({
        funnelState: "album_ready",
        chapterCount: 0,
        unwritten: 0,
        mediaCount: enough - 1,
        photoCount: enough - 1,
        sizeConfirmed: false,
      }),
    ).toBe("needPhotos");
  });

  it("groups the album into chapters once enough photos have arrived", () => {
    expect(
      nextBookStep({
        funnelState: "album_ready",
        chapterCount: 0,
        unwritten: 0,
        mediaCount: enough,
        photoCount: enough,
        sizeConfirmed: true,
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
        photoCount: enough - 1,
        sizeConfirmed: true,
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
        photoCount: enough,
        sizeConfirmed: true,
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
        photoCount: enough,
        sizeConfirmed: true,
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
        photoCount: enough,
        sizeConfirmed: true,
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
        photoCount: enough,
        sizeConfirmed: true,
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
          photoCount: enough,
          sizeConfirmed: true,
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
          photoCount: enough,
          sizeConfirmed: true,
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
        photoCount: enough,
        sizeConfirmed: true,
      }),
    ).toBe("wait");
  });

  it("asks for photographs when the album is nothing but videos", () => {
    // Videos clear the size gate and then propose no chapters at all, so the
    // waiting screen used to sit there for a book that could never be built.
    expect(
      nextBookStep({
        funnelState: "album_ready",
        chapterCount: 0,
        unwritten: 0,
        mediaCount: enough,
        photoCount: 0,
        sizeConfirmed: true,
      }),
    ).toBe("needPhotos");
  });

  it("does not build a five chapter book out of one photograph", () => {
    // The chapter count floors at five whatever the album holds, so one
    // picture and twenty-four videos used to produce five chapters, four of
    // them empty, five paid writing calls and a fifty dollar price.
    expect(
      nextBookStep({
        funnelState: "album_ready",
        chapterCount: 0,
        unwritten: 0,
        mediaCount: enough,
        photoCount: 1,
        sizeConfirmed: true,
      }),
    ).toBe("needPhotos");
  });

  it("counts photographs rather than the album, so videos never fill the gap", () => {
    expect(
      nextBookStep({
        funnelState: "album_ready",
        chapterCount: 0,
        unwritten: 0,
        mediaCount: enough * 4,
        photoCount: enough - 1,
        sizeConfirmed: true,
      }),
    ).toBe("needPhotos");
  });
});
