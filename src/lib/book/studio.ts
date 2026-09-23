import { TEASER_INTERIOR_PAGES } from "@/lib/book/teaser";
import type { BookPage, Chapter, PageKind } from "@/types/book";

/**
 * The flip-through model behind the studio: one flat list of slides, the front
 * cover first and then every interior page in order.
 *
 * Both the reader and the editor run off this. The only difference between
 * them is whether the slides past the teaser are locked, which keeps the
 * signed-out preview and the signed-in editor from drifting apart.
 */

export type StudioSlide = {
  key: string;
  /** Position in the flip-through, counting the cover as the first page. */
  position: number;
  /** What to call this page in the filmstrip and the header. */
  label: string;
  /** Null on the cover, which is not an interior page. */
  page: BookPage | null;
  chapterId: string | null;
  /** First slide of a chapter — the filmstrip marks these. */
  chapterStart: boolean;
  /** Not readable without an account. */
  locked: boolean;
  /** Front and back matter the customer does not get to rearrange. */
  editable: boolean;
};

/**
 * Pages nobody edits. The imprint carries the print credit and the closing
 * line is the book's sign-off — both are part of the object rather than part
 * of the customer's story, and offering controls for them only invites a hunt
 * for settings that do not exist.
 */
const FIXED_KINDS: ReadonlySet<PageKind> = new Set<PageKind>(["imprint"]);

export function buildSlides(
  pages: BookPage[],
  chapters: Chapter[],
  options: { unlocked: boolean },
): StudioSlide[] {
  const chapterNumber = new Map(
    chapters.map((chapter, index) => [chapter.id, index + 1]),
  );
  const seenChapters = new Set<string>();

  const cover: StudioSlide = {
    key: "cover",
    position: 0,
    label: "Cover",
    page: null,
    chapterId: null,
    chapterStart: false,
    locked: false,
    editable: true,
  };

  const interior = pages.map((page, index): StudioSlide => {
    const chapterId = page.chapterId ?? null;
    const firstOfChapter = Boolean(chapterId && !seenChapters.has(chapterId));
    if (chapterId) seenChapters.add(chapterId);

    return {
      key: page.id,
      position: index + 1,
      label: labelFor(page, chapterId ? chapterNumber.get(chapterId) : undefined),
      page,
      chapterId,
      chapterStart: firstOfChapter,
      locked: !options.unlocked && index >= TEASER_INTERIOR_PAGES,
      editable: !FIXED_KINDS.has(page.kind),
    };
  });

  return [cover, ...interior];
}

function labelFor(page: BookPage, chapterNumber: number | undefined): string {
  switch (page.kind) {
    case "title":
      return "Title";
    case "dedication":
      return "Dedication";
    case "chapter-opener":
      return chapterNumber ? `Chapter ${chapterNumber}` : "Chapter";
    case "closing":
      return "Closing";
    case "imprint":
      return "Imprint";
    default:
      return `Page ${page.pageNumber}`;
  }
}

/** The last slide a signed-out reader can see, and the first they cannot. */
export function lockWallIndex(slides: StudioSlide[]): number | null {
  const index = slides.findIndex((slide) => slide.locked);
  return index === -1 ? null : index;
}

export function lockedCount(slides: StudioSlide[]): number {
  return slides.filter((slide) => slide.locked).length;
}
