import { describe, expect, it } from "vitest";

import { paginateBook } from "@/lib/book/pagination";
import { pdfPageCount } from "@/lib/book/pdf-pages";
import { renderTeaserPdf } from "@/lib/book/sample-pdf";
import { buildSlides, lockWallIndex, lockedCount } from "@/lib/book/studio";
import {
  TEASER_INTERIOR_PAGES,
  TEASER_PAGE_COUNT,
  TEASER_PDF_MAX_PAGES,
  summarizeTeaser,
  teaserPages,
} from "@/lib/book/teaser";
import type { BookMeta, Chapter } from "@/types/book";

function bookOf(chapterCount: number): {
  meta: BookMeta;
  chapters: Chapter[];
  pages: ReturnType<typeof paginateBook>;
} {
  const chapters: Chapter[] = Array.from({ length: chapterCount }, (_, index) => ({
    id: `chapter-${index + 1}`,
    index,
    photoIds: Array.from({ length: 20 }, (_u, photo) => `photo-${index}-${photo}`),
    candidateIds: [],
    startAt: null,
    endAt: null,
    title: `Chapter ${index + 1}`,
    dateLabel: "",
    blurb: "",
    places: [],
    heroPhotoId: `photo-${index}-0`,
    aiStatus: "done",
  }));
  const meta: BookMeta = {
    petName: "Biscuit",
    birthYear: "",
    deathYear: "",
    dedication: "",
    coverPhotoId: "photo-0-0",
  };
  return { meta, chapters, pages: paginateBook(meta, chapters) };
}

describe("the free teaser", () => {
  it("gives away ten pages including the cover, whatever the book's length", () => {
    for (const chapterCount of [5, 12, 50]) {
      const { pages } = bookOf(chapterCount);
      expect(teaserPages(pages)).toHaveLength(TEASER_INTERIOR_PAGES);
      expect(TEASER_INTERIOR_PAGES + 1).toBe(TEASER_PAGE_COUNT);
    }
  });

  it("counts what is being withheld so the wall can say it truthfully", () => {
    const { pages, chapters } = bookOf(5);
    const summary = summarizeTeaser(pages, chapters);

    // A five-chapter book is 54 interior pages; nine of them are free.
    expect(summary.shownPages).toBe(9);
    expect(summary.hiddenPages).toBe(pages.length - 9);
    expect(summary.shownChapters).toBe(1);
    expect(summary.hiddenChapters).toBe(4);
    expect(summary.complete).toBe(false);
  });

  it("reaches into the first chapter rather than stopping at the front matter", () => {
    const { pages } = bookOf(5);
    const kinds = teaserPages(pages).map((page) => page.kind);
    expect(kinds).toContain("title");
    expect(kinds).toContain("chapter-opener");
    expect(kinds).toContain("photos");
  });

  it("withholds nothing when the whole book already fits", () => {
    const pages = bookOf(5).pages.slice(0, 6);
    const summary = summarizeTeaser(pages, []);
    expect(summary.complete).toBe(true);
    expect(summary.hiddenPages).toBe(0);
  });

  it("renders a file the upload route actually accepts", async () => {
    // The one check that matters: not what the page-selection logic intends,
    // but what `renderTeaserPdf` actually produces and the upload route
    // actually counts. This is exactly the gap a real five-chapter book fell
    // through — the renderer's own "there is more" page pushed a normal
    // teaser to eleven pages while the route still capped it at ten.
    const { meta, chapters, pages } = bookOf(5);
    const blob = await renderTeaserPdf({ pages, chapters, meta, photos: new Map() });
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const pageCount = await pdfPageCount(bytes);

    // Cover, nine interior pages, and the notice that the book continues —
    // one more than the free content alone, and exactly what the cap allows.
    expect(pageCount).toBe(TEASER_PDF_MAX_PAGES);
    expect(pageCount).not.toBeGreaterThan(TEASER_PDF_MAX_PAGES);
  });
});

describe("the studio flip-through", () => {
  it("puts the cover first and never locks it", () => {
    const { pages, chapters } = bookOf(5);
    const slides = buildSlides(pages, chapters, { unlocked: false });

    expect(slides[0].label).toBe("Cover");
    expect(slides[0].page).toBeNull();
    expect(slides[0].locked).toBe(false);
    expect(slides).toHaveLength(pages.length + 1);
  });

  it("locks everything past the tenth page when signed out", () => {
    const { pages, chapters } = bookOf(5);
    const slides = buildSlides(pages, chapters, { unlocked: false });

    expect(lockWallIndex(slides)).toBe(TEASER_PAGE_COUNT);
    expect(slides.filter((slide) => !slide.locked)).toHaveLength(TEASER_PAGE_COUNT);
    expect(lockedCount(slides)).toBe(pages.length + 1 - TEASER_PAGE_COUNT);
  });

  it("locks nothing once there is an account", () => {
    const { pages, chapters } = bookOf(5);
    const slides = buildSlides(pages, chapters, { unlocked: true });

    expect(lockWallIndex(slides)).toBeNull();
    expect(lockedCount(slides)).toBe(0);
  });

  it("marks the first page of each chapter so the filmstrip can divide them", () => {
    const { pages, chapters } = bookOf(5);
    const slides = buildSlides(pages, chapters, { unlocked: true });
    expect(slides.filter((slide) => slide.chapterStart)).toHaveLength(5);
  });

  it("leaves the imprint page uneditable", () => {
    const { pages, chapters } = bookOf(5);
    const slides = buildSlides(pages, chapters, { unlocked: true });
    const imprint = slides.find((slide) => slide.page?.kind === "imprint");
    expect(imprint?.editable).toBe(false);
  });
});
