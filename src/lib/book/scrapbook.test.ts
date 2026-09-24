import { describe, expect, it } from "vitest";

import { BRAND_PALETTE, sanitizePalette } from "@/lib/book/palette";
import { paginateBook } from "@/lib/book/pagination";
import {
  DECOR_EDGE,
  designPage,
  photoCaption,
  photoWindow,
  rotatedHalfExtents,
  seededRandom,
  type DesignContext,
} from "@/lib/book/scrapbook";
import type { BookMeta, Chapter } from "@/types/book";

function book() {
  const chapters: Chapter[] = Array.from({ length: 5 }, (_, index) => ({
    id: `chapter-${index + 1}`,
    index,
    photoIds: Array.from({ length: 22 }, (_u, photo) => `p-${index}-${photo}`),
    candidateIds: [],
    startAt: null,
    endAt: null,
    title: `Chapter ${index + 1}`,
    dateLabel: "",
    blurb: "",
    places: [],
    heroPhotoId: `p-${index}-0`,
    aiStatus: "done",
  }));
  const meta: BookMeta = {
    petName: "Biscuit",
    birthYear: "",
    deathYear: "",
    dedication: "For Biscuit.",
    coverPhotoId: "p-0-0",
  };
  const orientations = new Map(
    chapters.flatMap((chapter) =>
      chapter.photoIds.map((id, index) => [
        id,
        (["portrait", "landscape", "square"] as const)[index % 3],
      ]),
    ),
  );
  const context: DesignContext = {
    orientationOf: (id) => orientations.get(id),
    captionOf: () => "June 2019",
    palette: BRAND_PALETTE,
  };
  return { pages: paginateBook(meta, chapters, orientations), context };
}

describe("the scrapbook design", () => {
  it("is the same every time a page is drawn", () => {
    const { pages, context } = book();
    for (const page of pages) {
      expect(designPage(page, context)).toEqual(designPage(page, context));
    }
  });

  it("gives every photo on a page its own print", () => {
    const { pages, context } = book();
    for (const page of pages.filter((entry) => entry.kind === "photos")) {
      const design = designPage(page, context);
      expect(design.prints.map((print) => print.photoId)).toEqual(page.photoIds);
      for (const print of design.prints) expect(print.tapes.length).toBeGreaterThan(0);
    }
  });

  it("keeps every tilted print on the page", () => {
    const { pages, context } = book();
    for (const page of pages) {
      for (const print of designPage(page, context).prints) {
        const { hw, hh } = rotatedHalfExtents(print);
        expect(print.cx - hw).toBeGreaterThanOrEqual(DECOR_EDGE - 1e-9);
        expect(print.cx + hw).toBeLessThanOrEqual(1 - DECOR_EDGE + 1e-9);
        expect(print.cy - hh).toBeGreaterThanOrEqual(DECOR_EDGE - 1e-9);
        expect(print.cy + hh).toBeLessThanOrEqual(1 - DECOR_EDGE + 1e-9);
        expect(Math.abs(print.rotation)).toBeLessThanOrEqual(3);
        const window = photoWindow(print);
        expect(window.w).toBeGreaterThan(0);
        expect(window.h).toBeGreaterThan(0);
      }
    }
  });

  it("never puts a doodle on top of a print", () => {
    const { pages, context } = book();
    for (const page of pages) {
      const design = designPage(page, context);
      for (const doodle of design.doodles) {
        for (const print of design.prints) {
          const { hw, hh } = rotatedHalfExtents(print);
          const clear =
            Math.abs(doodle.cx - print.cx) >= hw + doodle.size / 2 ||
            Math.abs(doodle.cy - print.cy) >= hh + doodle.size / 2;
          expect(clear).toBe(true);
        }
      }
    }
  });

  it("writes a date on polaroids only where there is room for one", () => {
    const { pages, context } = book();
    for (const page of pages.filter((entry) => entry.kind === "photos")) {
      const design = designPage(page, context);
      const captioned = design.prints.some((print) => print.caption);
      expect(captioned).toBe(page.photoIds.length <= 2);
    }
  });
});

describe("seededRandom", () => {
  it("repeats for a seed and differs between seeds", () => {
    const a = seededRandom("page-1");
    const b = seededRandom("page-1");
    const c = seededRandom("page-2");
    const first = [a(), a(), a()];
    expect([b(), b(), b()]).toEqual(first);
    expect([c(), c(), c()]).not.toEqual(first);
  });
});

describe("photoCaption", () => {
  it("names the month and year", () => {
    expect(photoCaption(Date.UTC(2019, 5, 15))).toBe("June 2019");
    expect(photoCaption(null)).toBeNull();
  });
});

describe("a pet's palette", () => {
  it("colors the paper, tape, scraps and doodles, and changes nothing else", () => {
    const { pages, context } = book();
    const palette = sanitizePalette({
      paper: "#fbf5ec",
      ink: "#2b1d16",
      accent: "#b3362b",
      tape: ["#f0b9a8", "#f4d6a0", "#cfe0c4", "#e9c7b6"],
      scraps: ["#f6e7d6", "#f3dcd6", "#e6eee0"],
      doodle: "#b3362b",
    });
    for (const page of pages) {
      const classic = designPage(page, context);
      const pets = designPage(page, { ...context, palette });
      expect(pets.paper).toBe(palette.paper);
      expect(pets.prints.map((print) => [print.cx, print.cy, print.rotation])).toEqual(
        classic.prints.map((print) => [print.cx, print.cy, print.rotation]),
      );
      for (const print of pets.prints) {
        for (const tape of print.tapes) expect(palette.tape).toContain(tape.color);
      }
      for (const scrap of pets.scraps) expect(palette.scraps).toContain(scrap.color);
      for (const doodle of pets.doodles) {
        expect([palette.doodle, palette.accent]).toContain(doodle.color);
      }
    }
  });
});
