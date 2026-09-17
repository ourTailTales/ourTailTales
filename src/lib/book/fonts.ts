import fontkit from "@pdf-lib/fontkit";
import type { PDFDocument, PDFFont } from "pdf-lib";

/**
 * pdf-lib's built-in standard fonts (Times Roman, Helvetica) are WinAnsi
 * (Latin-1) only, so any Vietnamese or other non-Latin-1 character a customer
 * types throws `WinAnsi cannot encode` and aborts the whole book. Noto Serif and
 * Noto Sans cover the full Latin range, including Vietnamese, so they replace the
 * standard fonts for every text role.
 */
const FONT_URLS = {
  serif: "/fonts/NotoSerif-Regular.ttf",
  serifItalic: "/fonts/NotoSerif-Italic.ttf",
  sans: "/fonts/NotoSans-Regular.ttf",
} as const;

export type BookFonts = {
  display: PDFFont;
  displayItalic: PDFFont;
  sans: PDFFont;
};

const fileCache = new Map<string, ArrayBuffer>();

async function loadFont(url: string): Promise<ArrayBuffer> {
  const cached = fileCache.get(url);
  if (cached) return cached;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Could not load book font ${url} (${response.status}).`);
  }
  const bytes = await response.arrayBuffer();
  fileCache.set(url, bytes);
  return bytes;
}

/** Registers fontkit and embeds the Unicode book fonts, subset per document. */
export async function embedBookFonts(pdf: PDFDocument): Promise<BookFonts> {
  pdf.registerFontkit(fontkit);

  const [serif, serifItalic, sans] = await Promise.all([
    loadFont(FONT_URLS.serif),
    loadFont(FONT_URLS.serifItalic),
    loadFont(FONT_URLS.sans),
  ]);

  return {
    display: await pdf.embedFont(serif, { subset: true }),
    displayItalic: await pdf.embedFont(serifItalic, { subset: true }),
    sans: await pdf.embedFont(sans, { subset: true }),
  };
}

/**
 * Replaces any character the font cannot encode with a space, so a single
 * unsupported glyph degrades instead of throwing and killing the render. The
 * Unicode book fonts already draw a missing glyph as a blank box rather than
 * throwing; this stays as a guard for control characters and any future font.
 */
export function sanitizeForFont(font: PDFFont, text: string): string {
  let result = "";
  for (const character of text) {
    try {
      font.encodeText(character);
      result += character;
    } catch {
      result += " ";
    }
  }
  return result;
}
