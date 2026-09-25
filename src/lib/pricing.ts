/**
 * ourTailTales product/pricing math.
 *
 * Album size never affects price. Price is a function of the customer's
 * chosen chapter count only.
 */

/**
 * The clean, unwatermarked PDF of the whole book. Authoritative here rather
 * than in the checkout route, so no browser-supplied amount is ever charged.
 */
export const DIGITAL_PRICE = 4.99;

/** The base book contains five ten-page story chapters (50 story pages). */
export const BASE_CHAPTERS = 5;
export const BASE_PRICE = 49.99;
export const PRICE_PER_EXTRA_CHAPTER = 4.99;
export const STORY_PAGES_PER_CHAPTER = 10;

/**
 * How long a chapter may actually run.
 *
 * A chapter is no longer a fixed ten pages. It is as long as its own
 * photographs are worth — three pages at the least, ten at the most — which
 * is what stops a small album from printing half a book of empty paper and a
 * large one from burying a chapter's best pictures six to a page.
 * `STORY_PAGES_PER_CHAPTER` stays the number the price is quoted on.
 */
export const MIN_STORY_PAGES_PER_CHAPTER = 3;
export const MAX_STORY_PAGES_PER_CHAPTER = STORY_PAGES_PER_CHAPTER;

/** Title, dedication, closing, imprint. Included at no extra charge. */
export const FIXED_INTERIOR_PAGES = 4;

/** Cap after physical-sample testing. 50 => 500 story / 504 Lulu pages. */
export const MAX_CHAPTERS = 50;

/**
 * Customer-selectable density: five to thirty photos per chapter.
 */
export const PHOTOS_PER_CHAPTER_TARGET = { min: 5, max: 30 } as const;

/**
 * Hard lower bound for forming an additional chapter.
 */
export const MIN_PHOTOS_PER_CHAPTER = PHOTOS_PER_CHAPTER_TARGET.min;

/**
 * Smallest sellable album: five chapters with five photos per chapter.
 * Photos and videos both count toward this gate.
 */
export const MIN_PHOTOS_FOR_BOOK =
  BASE_CHAPTERS * PHOTOS_PER_CHAPTER_TARGET.min;

export const RECOMMENDED_CHAPTERS = BASE_CHAPTERS;

export function bookPrice(chapterCount: number): number {
  const extra = Math.max(0, chapterCount - BASE_CHAPTERS);
  return round2(BASE_PRICE + extra * PRICE_PER_EXTRA_CHAPTER);
}

export function storyPages(chapterCount: number): number {
  return chapterCount * STORY_PAGES_PER_CHAPTER;
}

export function luluInteriorPages(chapterCount: number): number {
  return storyPages(chapterCount) + FIXED_INTERIOR_PAGES;
}

/**
 * The fewest interior pages the printer will bind.
 *
 * Lulu's hardcover (casewrap) minimum. A book shorter than this is padded
 * with blank leaves at the back to reach it — the only place blank paper is
 * ever printed. Confirm against the pod package in `LULU_POD_PACKAGE_ID`
 * before changing it: ordering below a package's minimum is rejected at the
 * cover-dimensions call, before the customer pays.
 */
export const MIN_PRINTABLE_INTERIOR_PAGES = 24;

/**
 * How many interior pages to order for a book that is `actualPages` long.
 *
 * Chapters are as long as their photographs are worth, so a book is rarely
 * exactly `chapters × 10 + 4`. What is ordered is what the book actually
 * needs: never more than the chapters bought allow, never fewer than the
 * printer binds, and always an even count, because a leaf has two sides.
 */
export function orderedInteriorPages(
  actualPages: number,
  chapterCount: number,
): number {
  const ceiling = luluInteriorPages(chapterCount);
  const wanted = Math.max(actualPages, MIN_PRINTABLE_INTERIOR_PAGES);
  const even = wanted + (wanted % 2);
  return Math.min(even, ceiling);
}

export type BookSpec = {
  chapterCount: number;
  storyPages: number;
  fixedPages: number;
  totalInteriorPages: number;
  price: number;
  estimatedPhotos: { min: number; max: number };
};

export function bookSpec(chapterCount: number): BookSpec {
  return {
    chapterCount,
    storyPages: storyPages(chapterCount),
    fixedPages: FIXED_INTERIOR_PAGES,
    totalInteriorPages: luluInteriorPages(chapterCount),
    price: bookPrice(chapterCount),
    estimatedPhotos: {
      min: chapterCount * PHOTOS_PER_CHAPTER_TARGET.min,
      max: chapterCount * PHOTOS_PER_CHAPTER_TARGET.max,
    },
  };
}

/**
 * Highest chapter count this album can fill without inventing empty or
 * repetitive chapters. The base five-chapter book is always offered, since it is
 * the minimum sellable product.
 */
export function maxSupportedChapters(usablePhotoCount: number): number {
  const byPhotos = Math.floor(usablePhotoCount / MIN_PHOTOS_PER_CHAPTER);
  return clamp(byPhotos, BASE_CHAPTERS, MAX_CHAPTERS);
}

/**
 * Default slider position: five chapters when the album supports it.
 *
 * `MIN_PHOTOS_PER_CHAPTER` is the hard floor that keeps pages from being
 * padded; this is the softer density below which a chapter reads as thin, so a
 * sparse album opens on a shorter book instead of a stretched one.
 */
const COMFORTABLE_PHOTOS_PER_CHAPTER = 15;

export function recommendedChapters(usablePhotoCount: number): number {
  const supported = maxSupportedChapters(usablePhotoCount);
  const comfortable = Math.floor(
    usablePhotoCount / COMFORTABLE_PHOTOS_PER_CHAPTER,
  );
  return clamp(
    Math.min(RECOMMENDED_CHAPTERS, comfortable),
    BASE_CHAPTERS,
    supported,
  );
}

export function formatUsd(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
