import fs from "node:fs";
import path from "node:path";

import { PDFDocument } from "pdf-lib";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { paginateBook } from "@/lib/book/pagination";
import { pdfPageCount } from "@/lib/book/pdf-pages";
import { drawable, loadBookFonts, setFontLoader } from "@/lib/book/pdf-fonts";
import { renderTeaserPdf } from "@/lib/book/sample-pdf";
import { TEASER_PDF_MAX_PAGES } from "@/lib/book/teaser";
import type { BookMeta, Chapter } from "@/types/book";

const FONT_DIR = path.join(process.cwd(), "public", "fonts");

describe("the book's embedded fonts", () => {
  beforeAll(() => {
    setFontLoader(async (file) => new Uint8Array(fs.readFileSync(path.join(FONT_DIR, file))));
  });
  afterAll(() => {
    setFontLoader(async () => {
      throw new Error("no fonts in tests by default");
    });
  });

  it("embeds the real faces, not the standard-font stand-ins", async () => {
    const pdf = await PDFDocument.create();
    const fonts = await loadBookFonts(pdf);
    expect(fonts.embedded).toBe(true);

    // The words that lost letters to ligatures: "The", "first", "left".
    const page = pdf.addPage([400, 400]);
    for (const font of [fonts.hand, fonts.serif, fonts.serifBold, fonts.serifItalic]) {
      page.drawText("The first left shoe — Émile’s “café”", { x: 10, y: 200, font, size: 14 });
      expect(font.widthOfTextAtSize("The", 14)).toBeGreaterThan(font.widthOfTextAtSize("Te", 14));
    }
    const bytes = await pdf.save();
    expect(bytes.length).toBeGreaterThan(1000);
  });

  it("renders a whole teaser with them", async () => {
    const chapters: Chapter[] = Array.from({ length: 5 }, (_, index) => ({
      id: `chapter-${index + 1}`,
      index,
      photoIds: Array.from({ length: 20 }, (_u, photo) => `photo-${index}-${photo}`),
      candidateIds: [],
      startAt: null,
      endAt: null,
      title: `The first chapter 🐾 ${index + 1}`,
      dateLabel: "Spring 2016",
      blurb: "He arrived in a cardboard box lined with an old sweater.",
      places: [],
      heroPhotoId: `photo-${index}-0`,
      aiStatus: "done",
    }));
    const meta: BookMeta = {
      petName: "Biscuit",
      birthYear: "2015",
      deathYear: "2024",
      dedication: "For Biscuit, always.",
      coverPhotoId: "photo-0-0",
    };
    const blob = await renderTeaserPdf({
      pages: paginateBook(meta, chapters),
      chapters,
      meta,
      photos: new Map(),
      expiresAt: new Date(Date.now() + 30 * 864e5),
    });
    expect(await pdfPageCount(new Uint8Array(await blob.arrayBuffer()))).toBe(
      TEASER_PDF_MAX_PAGES,
    );
  });
});

describe("drawable", () => {
  it("drops what a standard font cannot encode instead of throwing", async () => {
    const pdf = await PDFDocument.create();
    setFontLoader(async () => {
      throw new Error("offline");
    });
    const fonts = await loadBookFonts(pdf);
    expect(fonts.embedded).toBe(false);
    expect(drawable(fonts.serif, "Biscuit 🐾")).toBe("Biscuit ");
  });
});
