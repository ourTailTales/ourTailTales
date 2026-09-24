import * as fontkit from "fontkit";
import { StandardFonts, type PDFDocument, type PDFFont } from "pdf-lib";

import type { CoverFontId } from "@/types/book";

/**
 * The book's real typefaces, embedded in the PDF.
 *
 * pdf-lib only knows the 14 standard PDF fonts, so the printed book used to be
 * set in Times and Helvetica while the screen showed Cormorant, Merienda and
 * Caveat. The scrapbook design leans on the handwriting face for captions, so
 * the files are shipped in `public/fonts` (all SIL OFL) and embedded, subset
 * to the glyphs a book actually uses.
 *
 * Fetched lazily and once per page load: the bytes are only needed at the
 * moment a PDF is rendered, never to show the site. If a fetch fails the book
 * still renders, in the standard fonts it always used to.
 */

export const FONT_FILES = {
  hand: "Caveat-SemiBold.ttf",
  handBold: "Caveat-Bold.ttf",
  serif: "CormorantGaramond-Medium.ttf",
  serifItalic: "CormorantGaramond-MediumItalic.ttf",
  serifBold: "CormorantGaramond-SemiBold.ttf",
  merienda: "Merienda-Regular.ttf",
  meriendaBold: "Merienda-Bold.ttf",
  playfair: "PlayfairDisplay-Regular.ttf",
  playfairBold: "PlayfairDisplay-Bold.ttf",
} as const;

export type FontFile = (typeof FONT_FILES)[keyof typeof FONT_FILES];

type FontLoader = (file: FontFile) => Promise<Uint8Array>;

const browserLoader: FontLoader = async (file) => {
  const response = await fetch(`/fonts/${file}`);
  if (!response.ok) throw new Error(`Font ${file} could not be loaded.`);
  return new Uint8Array(await response.arrayBuffer());
};

let loader: FontLoader = browserLoader;
const cache = new Map<FontFile, Promise<Uint8Array>>();

/** Tests read the files from disk; the browser fetches them. */
export function setFontLoader(next: FontLoader): void {
  loader = next;
  cache.clear();
}

function fontBytes(file: FontFile): Promise<Uint8Array> {
  let pending = cache.get(file);
  if (!pending) {
    pending = loader(file);
    // A failure is not cached, so the next render can try again.
    pending.catch(() => cache.delete(file));
    cache.set(file, pending);
  }
  return pending;
}

export type BookFonts = {
  /** Caveat — captions, the title page, handwritten lines. */
  hand: PDFFont;
  handBold: PDFFont;
  /** Cormorant Garamond — titles and running text. */
  serif: PDFFont;
  serifItalic: PDFFont;
  serifBold: PDFFont;
  merienda: PDFFont;
  meriendaBold: PDFFont;
  playfair: PDFFont;
  playfairBold: PDFFont;
  /** Helvetica — small tracked labels, the imprint. */
  sans: PDFFont;
  sansBold: PDFFont;
  /** False when the real faces could not be loaded and these are stand-ins. */
  embedded: boolean;
};

/**
 * pdf-lib expects the old `@pdf-lib/fontkit` fork, which cannot parse these
 * fonts (a Google Fonts build of Cormorant throws, and subsetting Caveat drops
 * letters). Upstream fontkit handles them; the only API difference pdf-lib
 * touches is that a subset now encodes to bytes in one call rather than
 * streaming, so this presents that as the stream pdf-lib listens to.
 */
type Listener = (value?: unknown) => void;

const fontkitForPdfLib = {
  create(data: Uint8Array) {
    const font = fontkit.create(data as Buffer) as fontkit.Font;
    const createSubset = font.createSubset.bind(font);
    Object.assign(font, {
      createSubset() {
        const subset = createSubset() as unknown as { encode: () => Uint8Array };
        return Object.assign(subset, {
          encodeStream() {
            const listeners: Record<string, Listener> = {};
            const stream = {
              on(event: string, listener: Listener) {
                listeners[event] = listener;
                return stream;
              },
            };
            queueMicrotask(() => {
              try {
                listeners.data?.(subset.encode());
                listeners.end?.();
              } catch (error) {
                listeners.error?.(error);
              }
            });
            return stream;
          },
        });
      },
    });
    return font;
  },
};

const documentFonts = new WeakMap<PDFDocument, Promise<BookFonts>>();

/** Every face the book uses, embedded into `pdf` once however often asked. */
export function loadBookFonts(pdf: PDFDocument): Promise<BookFonts> {
  let fonts = documentFonts.get(pdf);
  if (!fonts) {
    fonts = embedBookFonts(pdf);
    documentFonts.set(pdf, fonts);
  }
  return fonts;
}

async function embedBookFonts(pdf: PDFDocument): Promise<BookFonts> {
  const sans = await pdf.embedFont(StandardFonts.Helvetica);
  const sansBold = await pdf.embedFont(StandardFonts.HelveticaBold);

  try {
    pdf.registerFontkit(fontkitForPdfLib as unknown as Parameters<PDFDocument["registerFontkit"]>[0]);
    // Ligatures off: fontkit lays "Th" and "fi" out as one ligature glyph,
    // and pdf-lib, which measures and encodes text a character at a time,
    // then loses a letter of each pair ("The" printed as "T e").
    const embed = async (file: FontFile): Promise<PDFFont> =>
      pdf.embedFont(await fontBytes(file), {
        subset: true,
        features: { liga: false, clig: false, dlig: false, calt: false },
      });

    return {
      hand: await embed(FONT_FILES.hand),
      handBold: await embed(FONT_FILES.handBold),
      serif: await embed(FONT_FILES.serif),
      serifItalic: await embed(FONT_FILES.serifItalic),
      serifBold: await embed(FONT_FILES.serifBold),
      merienda: await embed(FONT_FILES.merienda),
      meriendaBold: await embed(FONT_FILES.meriendaBold),
      playfair: await embed(FONT_FILES.playfair),
      playfairBold: await embed(FONT_FILES.playfairBold),
      sans,
      sansBold,
      embedded: true,
    };
  } catch {
    const serif = await pdf.embedFont(StandardFonts.TimesRoman);
    const serifItalic = await pdf.embedFont(StandardFonts.TimesRomanItalic);
    const serifBold = await pdf.embedFont(StandardFonts.TimesRomanBold);
    return {
      hand: serifItalic,
      handBold: serifItalic,
      serif,
      serifItalic,
      serifBold,
      merienda: serifItalic,
      meriendaBold: serifItalic,
      playfair: serif,
      playfairBold: serifBold,
      sans,
      sansBold,
      embedded: false,
    };
  }
}

/** The cover editor's five name fonts, as the real embedded faces. */
export function coverNameFont(
  fontId: CoverFontId,
  fonts: BookFonts,
  bold: boolean,
): PDFFont {
  switch (fontId) {
    case "sans":
      return bold ? fonts.sansBold : fonts.sans;
    case "display":
      return bold ? fonts.meriendaBold : fonts.merienda;
    case "caveat":
      return bold ? fonts.handBold : fonts.hand;
    case "playfair":
      return bold ? fonts.playfairBold : fonts.playfair;
    case "cover":
    default:
      return bold ? fonts.serifBold : fonts.serif;
  }
}

/**
 * Drops characters a font cannot draw. A standard-font fallback cannot encode
 * anything outside WinAnsi and pdf-lib throws on it, which would take the
 * whole render down over one emoji in a chapter title.
 */
export function drawable(font: PDFFont, text: string): string {
  try {
    font.encodeText(text);
    return text;
  } catch {
    return [...text]
      .filter((character) => {
        try {
          font.encodeText(character);
          return true;
        } catch {
          return false;
        }
      })
      .join("");
  }
}
