import { describe, expect, it, vi } from "vitest";

const render = vi.hoisted(() =>
  vi.fn<(options: { meta: { designId?: string } }) => Promise<unknown>>(async () => ({
    bytes: new Uint8Array(),
    pageCount: 0,
    lowResWarnings: [],
  })),
);
vi.mock("@/lib/book/interior-pdf", () => ({ renderInteriorPdf: render }));

import {
  renderCleanBookPdf,
  renderFullPreviewPdf,
  renderTeaserPdf,
} from "@/lib/book/sample-pdf";
import type { BookMeta } from "@/types/book";

const meta: BookMeta = {
  petName: "Biscuit",
  birthYear: "",
  deathYear: "",
  coverPhotoId: null,
  designId: "vintage",
};

describe("the free preview's design", () => {
  it("is always the scrapbook, whatever the book is set to", async () => {
    await renderTeaserPdf({ pages: [], chapters: [], meta, photos: new Map() });
    expect(render.mock.calls.at(-1)![0].meta.designId).toBe("scrapbook");
  });

  it("follows the book once there is an account", async () => {
    await renderFullPreviewPdf({ pages: [], chapters: [], meta, photos: new Map() });
    expect(render.mock.calls.at(-1)![0].meta.designId).toBe("vintage");
  });
});

describe("the difference between the account-holder's preview and the buyer's file", () => {
  it("stamps a watermark into the account-holder's preview", async () => {
    await renderFullPreviewPdf({ pages: [], chapters: [], meta, photos: new Map() });
    const options = render.mock.calls.at(-1)![0] as { watermark?: string };
    expect(options.watermark).toBeTruthy();
  });

  it("never stamps a watermark into the file banked for a buyer", async () => {
    await renderCleanBookPdf({ pages: [], chapters: [], meta, photos: new Map() });
    const options = render.mock.calls.at(-1)![0] as { watermark?: string };
    expect(options.watermark).toBeUndefined();
  });
});
