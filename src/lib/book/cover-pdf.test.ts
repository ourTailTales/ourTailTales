import { readFile } from "node:fs/promises";
import path from "node:path";

import { PDFDocument } from "pdf-lib";
import { beforeAll, describe, expect, it } from "vitest";

import { COVER_LAYOUTS } from "@/lib/book/coverLayouts";
import { renderCoverPdf } from "@/lib/book/cover-pdf";
import { setFontLoader } from "@/lib/book/pdf-fonts";
import type { BookMeta, CoverLayoutId } from "@/types/book";

const DIMENSIONS = { width: 1300, height: 640 };

function meta(coverLayoutId: CoverLayoutId): BookMeta {
  return {
    petName: "Biscuit",
    birthYear: "2011",
    deathYear: "2024",
    dedication: "For the best copilot a family could ask for.",
    coverPhotoId: null,
    coverLayoutId,
  };
}

beforeAll(() => {
  setFontLoader(async (file) =>
    new Uint8Array(await readFile(path.join(process.cwd(), "public", "fonts", file))),
  );
});

describe("printing a cover", () => {
  it("renders every style at exactly the size the printer asked for", async () => {
    for (const layout of COVER_LAYOUTS) {
      const blob = await renderCoverPdf({ meta: meta(layout.id), dimensions: DIMENSIONS });
      const pdf = await PDFDocument.load(new Uint8Array(await blob.arrayBuffer()));

      expect(pdf.getPageCount()).toBe(1);
      const size = pdf.getPage(0).getSize();
      expect(Math.round(size.width)).toBe(DIMENSIONS.width);
      expect(Math.round(size.height)).toBe(DIMENSIONS.height);
    }
  });

  it("prints the covers that carry no photograph without one", async () => {
    // Nothing is in the asset store, so a photographic cover falls back to a
    // flat panel; the keepsake covers are finished as they are.
    for (const layout of COVER_LAYOUTS.filter((entry) => !entry.usesPhoto)) {
      const blob = await renderCoverPdf({ meta: meta(layout.id), dimensions: DIMENSIONS });
      expect(blob.size).toBeGreaterThan(1000);
    }
  });
});
