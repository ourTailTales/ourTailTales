import { describe, expect, it } from "vitest";

import { DESIGNS, designPage, resolveDesign, withDesign } from "@/lib/book/design";
import { DECOR_EDGE } from "@/lib/book/design/designs/scrapbook";
import {
  numberWord,
  photoCaption,
  photoWindow,
  romanNumeral,
  rotatedHalfExtents,
  seededRandom,
  type DesignContext,
} from "@/lib/book/design/primitives";
import { layoutTextBlock } from "@/lib/book/design/text";
import { PHOTO_LAYOUTS, isCaptionLayout, layoutRegions } from "@/lib/book/layouts";
import { BRAND_PALETTE, sanitizePalette } from "@/lib/book/palette";
import { paginateBook } from "@/lib/book/pagination";
import type { BookMeta, BookPage, Chapter, DesignId } from "@/types/book";

const ORIENTATIONS = ["portrait", "landscape", "square"] as const;

function book(designId: DesignId = "scrapbook") {
  const chapters: Chapter[] = Array.from({ length: 5 }, (_, index) => ({
    id: `chapter-${index + 1}`,
    index,
    photoIds: Array.from({ length: 22 }, (_u, photo) => `p-${index}-${photo}`),
    candidateIds: [],
    startAt: null,
    endAt: null,
    title: `The summer we found the lake, chapter ${index + 1}`,
    dateLabel: "Summer 2019",
    blurb:
      "He met the water the way he met everything, all at once and with his whole body. By August he had a favourite rock and an opinion about every duck on the far shore.",
    places: [],
    heroPhotoId: `p-${index}-0`,
    aiStatus: "done",
  }));
  const meta: BookMeta = {
    petName: "Biscuit",
    birthYear: "2011",
    deathYear: "2024",
    dedication: "For Biscuit, who made every walk an adventure.",
    coverPhotoId: "p-0-0",
    designId,
  };
  const orientations = new Map(
    chapters.flatMap((chapter) =>
      chapter.photoIds.map((id, index) => [id, ORIENTATIONS[index % 3]]),
    ),
  );
  const contextFor = (page: BookPage): DesignContext => ({
    meta,
    chapter: chapters.find((chapter) => chapter.id === page.chapterId),
    orientationOf: (id) => orientations.get(id),
    captionOf: () => "June 2019",
    palette: BRAND_PALETTE,
  });
  return { meta, chapters, pages: paginateBook(meta, chapters, orientations), contextFor };
}

/** A photo page in `layoutId`, filled with as many photos as it holds. */
function photoPage(layoutId: (typeof PHOTO_LAYOUTS)[number]): BookPage {
  return {
    id: `page-test-${layoutId.id}`,
    kind: "photos",
    pageNumber: 3,
    layoutId: layoutId.id,
    photoIds: Array.from({ length: layoutId.photoCount }, (_, index) => `p-0-${index + 1}`),
    chapterId: "chapter-1",
    chapterIndex: 0,
  };
}

describe("every design", () => {
  for (const design of DESIGNS) {
    describe(design.name, () => {
      it("is the same every time a page is drawn", () => {
        const { pages, contextFor } = book(design.id);
        for (const page of pages) {
          expect(designPage(page, contextFor(page))).toEqual(designPage(page, contextFor(page)));
        }
      });

      it("gives every photo on every layout its own print", () => {
        const { contextFor } = book(design.id);
        for (const layout of PHOTO_LAYOUTS) {
          const page = photoPage(layout);
          const drawn = designPage(page, contextFor(page));
          expect(drawn.prints.map((print) => print.photoId)).toEqual(page.photoIds);
          for (const print of drawn.prints) {
            const window = photoWindow(print);
            expect(window.w).toBeGreaterThan(0.05);
            expect(window.h).toBeGreaterThan(0.05);
          }
        }
      });

      it("keeps prints on the page and apart from one another", () => {
        const { contextFor } = book(design.id);
        for (const layout of PHOTO_LAYOUTS) {
          const page = photoPage(layout);
          const prints = designPage(page, contextFor(page)).prints;
          for (const print of prints) {
            const { hw, hh } = rotatedHalfExtents(print);
            expect(print.cx - hw).toBeGreaterThanOrEqual(-1e-9);
            expect(print.cx + hw).toBeLessThanOrEqual(1 + 1e-9);
            expect(print.cy - hh).toBeGreaterThanOrEqual(-1e-9);
            expect(print.cy + hh).toBeLessThanOrEqual(1 + 1e-9);
          }
          // Unrotated centres never coincide: no two photos stacked in one spot.
          const centres = new Set(prints.map((print) => `${print.cx.toFixed(3)},${print.cy.toFixed(3)}`));
          expect(centres.size).toBe(prints.length);
        }
      });

      it("keeps a written note inside the card it is written on", () => {
        const { contextFor } = book(design.id);
        // The longest a note can be, which is where a card overflows if it
        // is going to (see MAX_NOTE_LENGTH).
        const note =
          "He met the water the way he met everything, all at once and with his whole body. " +
          "By August he had a favourite rock and an opinion about every duck on the far shore, " +
          "and no walk ever got past either of them.";
        for (const layout of PHOTO_LAYOUTS.filter((spec) => spec.noteCount > 0)) {
          const page = {
            ...photoPage(layout),
            notes: Array.from({ length: layout.noteCount }, () => note),
          };
          for (const block of designPage(page, contextFor(page)).texts) {
            const laid = layoutTextBlock(block);
            for (const line of laid.lines) {
              expect(line.textWidth).toBeLessThanOrEqual(laid.width + 1e-6);
            }
            expect(laid.used).toBeLessThanOrEqual(laid.height + 1e-6);
          }
        }
      });

      it("keeps its words inside the page", () => {
        const { pages, contextFor } = book(design.id);
        for (const page of pages) {
          for (const block of designPage(page, contextFor(page)).texts) {
            expect(block.x).toBeGreaterThanOrEqual(0);
            expect(block.y).toBeGreaterThanOrEqual(0);
            expect(block.x + block.w).toBeLessThanOrEqual(1 + 1e-9);
            expect(block.y + block.h).toBeLessThanOrEqual(1 + 1e-9);
          }
        }
      });

      it("writes the book's own words on its fixed pages", () => {
        const { pages, contextFor } = book(design.id);
        const words = (kind: BookPage["kind"]) => {
          const page = pages.find((entry) => entry.kind === kind)!;
          return designPage(page, contextFor(page))
            .texts.flatMap((block) => layoutTextBlock(block).lines.map((line) => line.text))
            .join(" ");
        };
        expect(words("title")).toMatch(/Biscuit/);
        expect(words("dedication")).toMatch(/adventure/);
        expect(words("chapter-opener")).toMatch(/summer we found the lake/i);
        expect(words("closing")).toMatch(/Always part of the story/i);
        expect(words("imprint")).toMatch(/Biscuit's own photographs/);
      });
    });
  }
});

describe("the scrapbook design", () => {
  it("keeps every tilted print inside the decorative edge", () => {
    const { pages, contextFor } = book();
    for (const page of pages) {
      for (const print of designPage(page, contextFor(page)).prints) {
        const { hw, hh } = rotatedHalfExtents(print);
        expect(print.cx - hw).toBeGreaterThanOrEqual(DECOR_EDGE - 1e-9);
        expect(print.cx + hw).toBeLessThanOrEqual(1 - DECOR_EDGE + 1e-9);
        expect(print.cy - hh).toBeGreaterThanOrEqual(DECOR_EDGE - 1e-9);
        expect(print.cy + hh).toBeLessThanOrEqual(1 - DECOR_EDGE + 1e-9);
        expect(Math.abs(print.rotation)).toBeLessThanOrEqual(3.3);
      }
    }
  });

  it("tapes every print down", () => {
    const { contextFor } = book();
    for (const layout of PHOTO_LAYOUTS) {
      const page = photoPage(layout);
      for (const print of designPage(page, contextFor(page)).prints) {
        expect(print.tapes.length).toBeGreaterThan(0);
      }
    }
  });

  it("keeps every doodle inside the trim", () => {
    const { pages, contextFor } = book();
    const all = [...pages, ...PHOTO_LAYOUTS.map(photoPage)];
    for (const page of all) {
      for (const doodle of designPage(page, contextFor(page)).doodles) {
        expect(doodle.cx - doodle.size / 2).toBeGreaterThanOrEqual(DECOR_EDGE - 1e-9);
        expect(doodle.cx + doodle.size / 2).toBeLessThanOrEqual(1 - DECOR_EDGE + 1e-9);
        expect(doodle.cy - doodle.size / 2).toBeGreaterThanOrEqual(DECOR_EDGE - 1e-9);
        expect(doodle.cy + doodle.size / 2).toBeLessThanOrEqual(1 - DECOR_EDGE + 1e-9);
      }
    }
  });

  it("never puts a doodle on top of a print", () => {
    const { pages, contextFor } = book();
    const all = [...pages, ...PHOTO_LAYOUTS.map(photoPage)];
    for (const page of all) {
      const design = designPage(page, contextFor(page));
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
    const { contextFor } = book();
    for (const layout of PHOTO_LAYOUTS) {
      const page = photoPage(layout);
      const captioned = designPage(page, contextFor(page)).prints.some((print) => print.caption);
      // A caption layout already carries the date on its note card; printing
      // it on the photograph as well reads as a page that could not decide.
      expect(captioned).toBe(page.photoIds.length <= 2 && layout.noteCount === 0);
    }
  });

  it("tapes a note card to every page that keeps room for words", () => {
    const { contextFor } = book();
    for (const layout of PHOTO_LAYOUTS.filter((spec) => spec.noteCount > 0)) {
      const page = { ...photoPage(layout), notes: ["He swam in anything."] };
      const drawn = designPage(page, contextFor(page));
      const words = drawn.texts.flatMap((block) =>
        layoutTextBlock(block).lines.map((line) => line.text),
      );
      expect(words.join(" ")).toMatch(/swam in anything/);
      // The card sits behind the words and in front of nothing else.
      expect(drawn.under.some((shape) => shape.kind === "rect")).toBe(true);
    }
  });
});

describe("a pet's palette", () => {
  it("colors the paper, tape, scraps and doodles, and moves nothing", () => {
    const { pages, contextFor } = book();
    const palette = sanitizePalette({
      paper: "#fbf5ec",
      ink: "#2b1d16",
      accent: "#b3362b",
      tape: ["#f0b9a8", "#f4d6a0", "#cfe0c4", "#e9c7b6"],
      scraps: ["#f6e7d6", "#f3dcd6", "#e6eee0"],
      doodle: "#b3362b",
    });
    for (const page of pages) {
      const classic = designPage(page, contextFor(page));
      const pets = designPage(page, { ...contextFor(page), palette });
      expect(pets.paper).toBe(palette.paper);
      expect(pets.prints.map((print) => [print.cx, print.cy, print.rotation])).toEqual(
        classic.prints.map((print) => [print.cx, print.cy, print.rotation]),
      );
      for (const print of pets.prints) {
        for (const tape of print.tapes) expect(palette.tape).toContain(tape.color);
      }
      for (const shape of pets.under) {
        if (shape.kind === "rect" && shape.fill && shape.fill !== "#ffffff") {
          expect(palette.scraps).toContain(shape.fill);
        }
      }
      for (const doodle of pets.doodles) {
        expect([palette.doodle, palette.accent]).toContain(doodle.color);
      }
    }
  });
});

describe("choosing a design", () => {
  it("falls back to the scrapbook", () => {
    expect(resolveDesign({}).id).toBe("scrapbook");
    expect(resolveDesign({ designId: "nonsense" as DesignId }).id).toBe("scrapbook");
    expect(resolveDesign({ designId: "vintage" }).id).toBe("vintage");
  });

  it("restyles a page without moving its photos to another page", () => {
    const { meta, chapters, pages } = book("scrapbook");
    const again = paginateBook(withDesign(meta, "modern"), chapters);
    expect(again.map((page) => page.photoIds)).toEqual(
      paginateBook(meta, chapters).map((page) => page.photoIds),
    );
    expect(pages.length).toBe(again.length);
  });

  it("offers four designs, each distinct", () => {
    expect(DESIGNS.map((design) => design.id)).toEqual(["scrapbook", "classic", "modern", "vintage"]);
    const { pages, contextFor } = book();
    const page = pages.find((entry) => entry.kind === "photos" && entry.photoIds.length >= 2)!;
    const looks = DESIGNS.map((design) =>
      JSON.stringify(designPage(page, { ...contextFor(page), meta: withDesign(contextFor(page).meta, design.id) }).prints),
    );
    expect(new Set(looks).size).toBe(DESIGNS.length);
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

describe("words", () => {
  it("names the month and year a photo was taken", () => {
    expect(photoCaption(Date.UTC(2019, 5, 15))).toBe("June 2019");
    expect(photoCaption(null)).toBeNull();
  });

  it("spells chapter numbers", () => {
    expect(numberWord(1)).toBe("One");
    expect(numberWord(14)).toBe("Fourteen");
    expect(numberWord(23)).toBe("Twenty-Three");
    expect(numberWord(50)).toBe("Fifty");
    expect(romanNumeral(4)).toBe("IV");
    expect(romanNumeral(49)).toBe("XLIX");
  });
});

describe("layouts that hold words", () => {
  it("keeps room for one note per photo, never more than two", () => {
    for (const spec of PHOTO_LAYOUTS) {
      expect(spec.noteCount).toBeLessThanOrEqual(2);
      if (spec.noteCount > 0) {
        expect(spec.notesAt).toBeTruthy();
        expect(spec.noteCount).toBe(spec.photoCount === 2 ? 2 : 1);
        expect(spec.photoCount).toBeLessThanOrEqual(4);
      }
    }
    // Words to the right, to the left and underneath, with one to four photos.
    const captioned = PHOTO_LAYOUTS.filter((spec) => spec.noteCount > 0);
    expect(captioned).toHaveLength(12);
    expect(new Set(captioned.map((spec) => spec.notesAt))).toEqual(
      new Set(["right", "left", "below"]),
    );
  });

  it("never lays a note over a photograph", () => {
    const frame = { x: 0.08, y: 0.08, w: 0.84, h: 0.84 };
    for (const spec of PHOTO_LAYOUTS.filter((entry) => entry.noteCount > 0)) {
      const { photos, texts } = layoutRegions(spec.id, frame, { gutter: 0.02 });
      expect(photos).toHaveLength(spec.photoCount);
      expect(texts).toHaveLength(spec.noteCount);
      for (const photo of photos) {
        for (const text of texts) {
          const apart =
            photo.x + photo.w <= text.x + 1e-9 ||
            text.x + text.w <= photo.x + 1e-9 ||
            photo.y + photo.h <= text.y + 1e-9 ||
            text.y + text.h <= photo.y + 1e-9;
          expect(apart).toBe(true);
        }
        expect(photo.x).toBeGreaterThanOrEqual(frame.x - 1e-9);
        expect(photo.x + photo.w).toBeLessThanOrEqual(frame.x + frame.w + 1e-9);
      }
      for (const text of texts) {
        expect(text.w).toBeGreaterThan(0.1);
        expect(text.h).toBeGreaterThan(0.1);
      }
    }
  });

  it("falls back to the page's own date when nothing has been written", () => {
    const { contextFor } = book();
    const spec = PHOTO_LAYOUTS.find((entry) => entry.id === "caption-right-1")!;
    const page = photoPage(spec);
    const words = designPage(page, contextFor(page))
      .texts.flatMap((block) => layoutTextBlock(block).lines.map((line) => line.text))
      .join(" ");
    expect(words).toMatch(/June 2019/);
    expect(isCaptionLayout(page.layoutId)).toBe(true);
  });
});
