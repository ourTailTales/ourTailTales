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
 * What a chapter costs, and what a book of that length is called.
 *
 * One table, because the two must not drift: the price of the sixteenth
 * chapter and the moment a book becomes a Family Saga are the same boundary,
 * and a reader of this file should not have to check two places to see it.
 *
 * The rates ease off with length rather than staying flat. A long book is not
 * proportionally more work to print — Lulu's cost is linear at about $2.148 a
 * chapter — so the flat $4.99 quietly widened the margin on exactly the
 * customers with the most photographs, while the total ran to $274 at fifty
 * chapters. Easing the rate gives most of that back without going under the
 * floor.
 *
 * THE FLOOR IS 51% PRINT MARGIN, and it binds. At $2.148 a chapter the
 * marginal margin is 57% at $4.99, 52% at $4.49, 50% at $4.29 — the last is
 * under on the margin of that chapter alone, but the book's margin, which is
 * what matters, holds at 52.9% at fifty chapters because the earlier chapters
 * and the base carry it. Anything lower does not: $3.99 and $2.99 for these
 * two tiers, which were the first proposal, put a fifty-chapter book at 45.7%.
 * Re-derive from current Lulu quotes before moving any of these, and check
 * the whole book rather than one chapter.
 */
const TIERS = [
  { id: "keepsake", label: "Keepsake", upTo: BASE_CHAPTERS, perChapter: 0 },
  { id: "story", label: "Story", upTo: 15, perChapter: PRICE_PER_EXTRA_CHAPTER },
  { id: "saga", label: "Family Saga", upTo: 30, perChapter: 4.49 },
  { id: "life", label: "Complete Life Story", upTo: MAX_CHAPTERS, perChapter: 4.29 },
] as const satisfies readonly BookTier[];

export type BookTier = {
  id: "keepsake" | "story" | "saga" | "life";
  label: string;
  /** The longest book this tier covers. */
  upTo: number;
  /** What each chapter inside this tier adds to the price. */
  perChapter: number;
};

/** What the next chapter would add, at this length. */
export function nextChapterPrice(chapterCount: number): number {
  return round2(bookPrice(chapterCount + 1) - bookPrice(chapterCount));
}

/** "$4.99 each to 15, then $4.49 to 30, then $4.29" — read from the table. */
export function chapterRateSummary(): string {
  const paid = TIERS.filter((tier) => tier.perChapter > 0);
  return paid
    .map((tier, index) =>
      index === paid.length - 1
        ? `${formatUsd(tier.perChapter)} beyond ${paid[index - 1]?.upTo ?? BASE_CHAPTERS}`
        : `${formatUsd(tier.perChapter)} each to ${tier.upTo}`,
    )
    .join(", then ");
}

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

/**
 * What a book of this many chapters costs.
 *
 * The base book covers the first five; every chapter after that is charged at
 * the rate of the tier it falls into, so a thirty-chapter book pays $4.99 for
 * chapters six to fifteen and $4.49 for sixteen to thirty. The rate a chapter
 * is charged at never depends on chapters it is not — adding the thirty-first
 * chapter does not reprice the first thirty.
 */
export function bookPrice(chapterCount: number): number {
  let price = BASE_PRICE;
  let counted = BASE_CHAPTERS;
  for (const tier of TIERS) {
    const inTier = Math.max(0, Math.min(chapterCount, tier.upTo) - counted);
    price += inTier * tier.perChapter;
    counted = Math.max(counted, Math.min(chapterCount, tier.upTo));
  }
  // Past the printer's cap there is no tier to charge at; the last one holds.
  const past = Math.max(0, chapterCount - MAX_CHAPTERS);
  price += past * TIERS[TIERS.length - 1]!.perChapter;
  return round2(price);
}

/**
 * What to call a book of this length.
 *
 * A name the customer can hold on to when a number moves: "Family Saga" says
 * something a chapter count does not. The price changes across these
 * boundaries too — see `TIERS` — so the label is also the honest answer to
 * why the next chapter cost less than the last one.
 */
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
