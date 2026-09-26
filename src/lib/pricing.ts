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
 * The longest book offered without being asked for.
 *
 * `MAX_CHAPTERS` is what the printer will bind; this is what a customer is
 * shown by default. An album of four thousand photographs across two hundred
 * outings has fifty chapters' worth of periods in it, and quoting $274 to
 * somebody who came for a $49.99 book — because their camera roll is long —
 * is not an offer, it is an ambush. Past this, the longer book is offered
 * explicitly and taken explicitly.
 */
export const DEFAULT_CHAPTER_CAP = 12;

/**
 * Chapters past this one would carry `TOP_TIER_DISCOUNT_PER_CHAPTER`.
 */
export const TOP_TIER_FROM_CHAPTER = 30;

/**
 * A discount on the chapters of a very long book. Off.
 *
 * Here so that turning it on is a number rather than a rewrite — but the
 * headroom is small, and a future edit should not set it without redoing the
 * arithmetic. The basis, from the pricing review rather than from anything
 * this repository can check: Lulu's print cost runs about $2.148 a chapter
 * and is linear from five chapters to fifty, so the print margin holds at
 * roughly 55-57% across the whole range at $4.99 a chapter. That leaves about
 * 3-5% of real room — a $1 discount is most of it, a $2 discount is past it.
 * Re-derive from current Lulu quotes before changing this.
 */
export const TOP_TIER_DISCOUNT_PER_CHAPTER = 0;

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

export function bookPrice(chapterCount: number): number {
  const extra = Math.max(0, chapterCount - BASE_CHAPTERS);
  const discounted = Math.max(0, chapterCount - TOP_TIER_FROM_CHAPTER);
  return round2(
    BASE_PRICE +
      extra * PRICE_PER_EXTRA_CHAPTER -
      discounted * TOP_TIER_DISCOUNT_PER_CHAPTER,
  );
}

export type BookTier = {
  id: "keepsake" | "story" | "saga" | "life";
  label: string;
  /** The largest book this tier covers. */
  upTo: number;
};

/**
 * What to call a book of this length.
 *
 * Names for the customer's benefit only — nothing about the price, the
 * printing or the writing changes at a boundary. A five-chapter book and a
 * fifty-chapter book are the same product at different lengths, and the label
 * is there so the length means something when it is quoted.
 */
const TIERS: readonly BookTier[] = [
  { id: "keepsake", label: "Keepsake", upTo: BASE_CHAPTERS },
  { id: "story", label: "Story", upTo: 15 },
  { id: "saga", label: "Family Saga", upTo: 30 },
  { id: "life", label: "Complete Life Story", upTo: MAX_CHAPTERS },
];

export function bookTier(chapterCount: number): BookTier {
  return TIERS.find((tier) => chapterCount <= tier.upTo) ?? TIERS[TIERS.length - 1]!;
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
 * How many chapters an album comes to is `chaptersForAlbum` in
 * `lib/photo/cluster`, which reads the album's own dates. It used to be a
 * count guessed from the number of photographs here, and that guess could only
 * ever return five: it asked for `min(5, photos / 15)` and then clamped the
 * answer up to a floor of five.
 */

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
