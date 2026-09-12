/**
 * ourTailTales product/pricing math.
 *
 * Album size never affects price. Price is a function of the customer's
 * chosen chapter count only.
 */

export const BASE_CHAPTERS = 2;
export const BASE_PRICE = 49.99;
export const PRICE_PER_EXTRA_CHAPTER = 10;
export const STORY_PAGES_PER_CHAPTER = 10;

/** Title, dedication, closing, imprint. Included at no extra charge. */
export const FIXED_INTERIOR_PAGES = 4;

/** Raise after physical-sample testing. 12 => 120 story / 124 Lulu pages. */
export const MAX_CHAPTERS = 12;

export const PHOTOS_PER_CHAPTER_TARGET = { min: 20, max: 30 } as const;

/**
 * Floor before a chapter reads as empty or repetitive. Chapters may be
 * sparser than the 20-30 target, but not thinner than this: one hero image for
 * the opener plus at least one photo for each of the 9 photo pages, so no page
 * is padded with a repeated image.
 */
export const MIN_PHOTOS_PER_CHAPTER = 10;

export const RECOMMENDED_CHAPTERS = 4;

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
 * repetitive chapters. The base 2-chapter book is always offered, since it is
 * the minimum sellable product.
 */
export function maxSupportedChapters(usablePhotoCount: number): number {
  const byPhotos = Math.floor(usablePhotoCount / MIN_PHOTOS_PER_CHAPTER);
  return clamp(byPhotos, BASE_CHAPTERS, MAX_CHAPTERS);
}

/**
 * Default slider position: 4 chapters when the album supports it.
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
  return clamp(Math.min(RECOMMENDED_CHAPTERS, comfortable), BASE_CHAPTERS, supported);
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
