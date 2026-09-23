import {
  PDFArray,
  PDFDocument,
  PDFRawStream,
  decodePDFRawStream,
} from "pdf-lib";
import { describe, expect, it } from "vitest";

import { WATERMARK_TEXT, watermarkPdf } from "@/lib/book/watermark";

async function blankPdf(pageCount: number, size = 630): Promise<Uint8Array> {
  const document = await PDFDocument.create();
  for (let index = 0; index < pageCount; index += 1) {
    document.addPage([size, size]);
  }
  return document.save();
}

describe("watermarkPdf", () => {
  it("keeps every page and leaves the geometry alone", async () => {
    const source = await blankPdf(4);
    const stamped = await watermarkPdf(source);

    const result = await PDFDocument.load(stamped);
    expect(result.getPageCount()).toBe(4);
    expect(result.getPage(0).getSize()).toEqual({ width: 630, height: 630 });
  });

  it("does not mutate the bytes it was handed", async () => {
    const source = await blankPdf(2);
    const before = source.slice();
    await watermarkPdf(source);
    expect(source).toEqual(before);
  });

  it("writes the mark into the page content stream", async () => {
    const stamped = await watermarkPdf(await blankPdf(1));
    // Decoded rather than pattern-matched on the raw bytes: without this the
    // other assertions would all still pass on a document that had merely
    // been loaded and re-saved without drawing anything.
    const operators = await pageOperators(stamped);
    expect(operators).toContain("PREVIEW");
    expect(operators).toContain("Tj");
  });

  it("names the live domain so a leaked preview is traceable", () => {
    expect(WATERMARK_TEXT).toBe("PREVIEW — ourtailtales.com");
  });

  it("handles a non-square page without throwing", async () => {
    const document = await PDFDocument.create();
    document.addPage([612, 792]);
    const stamped = await watermarkPdf(await document.save());
    expect((await PDFDocument.load(stamped)).getPageCount()).toBe(1);
  });
});

/** Decode a page's content streams so its drawing operators can be read. */
async function pageOperators(pdf: Uint8Array, index = 0): Promise<string> {
  const document = await PDFDocument.load(pdf);
  const page = document.getPage(index);
  const contents = page.node.Contents();
  if (!contents) return "";

  const streams = contents instanceof PDFArray
    ? contents.asArray().map((ref) => document.context.lookup(ref))
    : [contents];

  return streams
    .filter((stream): stream is PDFRawStream => stream instanceof PDFRawStream)
    .map((stream) => Buffer.from(decodePDFRawStream(stream).decode()).toString("latin1"))
    .map(revealHexStrings)
    .join("\n");
}

/**
 * pdf-lib emits show-text arguments as hex literals (`<5052...> Tj`), so the
 * words are unreadable until those are turned back into characters.
 */
function revealHexStrings(operators: string): string {
  return operators.replace(/<([0-9A-Fa-f]+)>/g, (match, hex: string) =>
    hex.length % 2 === 0
      ? Buffer.from(hex, "hex").toString("latin1")
      : match,
  );
}
