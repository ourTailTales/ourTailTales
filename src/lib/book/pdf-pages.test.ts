import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";

import { pdfPageCount } from "@/lib/book/pdf-pages";
import { TEASER_PAGE_COUNT } from "@/lib/book/teaser";
import { allDraftPdfPaths, draftPdfPath } from "@/lib/drafts/storage";

async function pdfWith(pages: number): Promise<Uint8Array> {
  const document = await PDFDocument.create();
  for (let index = 0; index < pages; index += 1) document.addPage([200, 200]);
  return document.save();
}

describe("pdfPageCount", () => {
  it("counts the pages of a real PDF", async () => {
    expect(await pdfPageCount(await pdfWith(TEASER_PAGE_COUNT))).toBe(
      TEASER_PAGE_COUNT,
    );
  });

  it("sees a whole book banked as a teaser", async () => {
    const wholeBook = await pdfPageCount(await pdfWith(88));
    expect(wholeBook).not.toBeNull();
    expect(wholeBook! > TEASER_PAGE_COUNT).toBe(true);
  });

  it("is null rather than zero for bytes that are not a PDF", async () => {
    expect(await pdfPageCount(new TextEncoder().encode("not a pdf"))).toBeNull();
  });

  it("is null for a truncated upload", async () => {
    const whole = await pdfWith(4);
    expect(await pdfPageCount(whole.slice(0, whole.length >> 1))).toBeNull();
  });
});

describe("draft storage paths", () => {
  it("sweeps every file a draft can own, not only the recorded ones", () => {
    const paths = allDraftPdfPaths("abc");
    for (const kind of ["incoming", "teaser", "preview", "clean"] as const) {
      expect(paths).toContain(draftPdfPath("abc", kind));
    }
  });

  it("keeps uploads off every path that is served", () => {
    // The staging path is the only one a client is handed a signed URL for.
    const staging = draftPdfPath("abc", "incoming");
    for (const served of ["teaser", "preview", "clean"] as const) {
      expect(draftPdfPath("abc", served)).not.toBe(staging);
    }
  });
});
