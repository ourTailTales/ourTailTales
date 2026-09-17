import { readFileSync } from "node:fs";
import path from "node:path";

import { PDFDocument, StandardFonts } from "pdf-lib";
import { afterEach, describe, expect, it, vi } from "vitest";

import { embedBookFonts, sanitizeForFont } from "@/lib/book/fonts";

const FONT_DIR = path.resolve(process.cwd(), "public/fonts");
const VIETNAMESE = "Chương Ố Nàng — 2019 – 2024";

function stubFontFetch(): void {
  vi.stubGlobal("fetch", async (url: string) => {
    const bytes = readFileSync(path.join(FONT_DIR, path.basename(url)));
    return {
      ok: true,
      status: 200,
      arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    } as Response;
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("embedBookFonts", () => {
  it("draws Vietnamese text without throwing", async () => {
    stubFontFetch();
    const pdf = await PDFDocument.create();
    const fonts = await embedBookFonts(pdf);

    const page = pdf.addPage();
    for (const font of [fonts.display, fonts.displayItalic, fonts.sans]) {
      page.drawText(VIETNAMESE, { x: 10, y: 10, font, size: 12 });
    }

    const bytes = await pdf.save();
    expect(bytes.length).toBeGreaterThan(0);
  });
});

describe("sanitizeForFont", () => {
  it("keeps Vietnamese characters the book font supports", async () => {
    stubFontFetch();
    const pdf = await PDFDocument.create();
    const { display } = await embedBookFonts(pdf);

    expect(sanitizeForFont(display, VIETNAMESE)).toBe(VIETNAMESE);
  });

  it("replaces characters a Latin-1 font cannot encode with spaces", async () => {
    const pdf = await PDFDocument.create();
    const helvetica = await pdf.embedFont(StandardFonts.Helvetica);

    const cleaned = sanitizeForFont(helvetica, "Ố");
    expect(cleaned).toBe(" ");
    expect(() =>
      pdf.addPage().drawText(cleaned, { x: 10, y: 10, font: helvetica, size: 12 }),
    ).not.toThrow();
  });
});
