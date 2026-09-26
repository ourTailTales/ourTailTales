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

/** The shortest book we will print: five chapters. */
export const BASE_CHAPTERS = 5;
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

/**
 * Title, closing, imprint, plus one leaf of slack. Included at no extra
 * charge. Four rather than three so the ceiling this feeds
 * (`luluInteriorPages`) stays even — a leaf has two sides.
 */
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


/* --------------------------------- tiers --------------------------------- */

/** What the base price buys outright: a book of up to five chapters. */
export const BASE_PRICE = 49.99;

/**
 * A band of chapters and what each chapter inside it adds to the price.
 *
 * The base price covers the first five chapters whole — that is the Keepsake
 * book, and the rate on its band is zero because nothing is added for those
 * chapters. Past five, chapters are bought one at a time and get cheaper as
 * the book runs longer.
 *
 * The bands are *progressive*, the way income tax brackets are: a fifteen-
 * chapter book pays nothing extra for its first five, the Chronicle rate on
 * the seven after that, and the Archive rate on the last three. It is not one
 * flat rate chosen by the book's total length — that version makes a long
 * book cost less than a slightly shorter one, and an invoice that charges
 * more for less is one nobody trusts twice.
 *
 * What a chapter holds does not change between bands: every chapter in every
 * book runs `MIN_STORY_PAGES_PER_CHAPTER`–`MAX_STORY_PAGES_PER_CHAPTER` pages
 * and takes `PHOTOS_PER_CHAPTER_TARGET` photographs. The bands buy length,
 * not richness.
 *
 * ON PRINT MARGIN, because these rates were set as a product decision and the
 * costing says something the rates do not. Lulu's print cost is linear at
 * about $2.148 a chapter over $11.84 fixed, which reproduces the four quotes
 * in the pricing review to the cent. Against that, these rates hold above a
 * 51% margin to thirty-two chapters and slide under it after: 51.3% at
 * thirty, 50.3% at forty, 49.6% at fifty. A book that long is not what the
 * size step proposes — it offers a chapter per year of the album's span — but
 * it is reachable, by picking Archive on an album whose dates are wrong.
 * `MARGIN_FLOOR` and the test beside it pin exactly where the line falls, so
 * moving a rate says what it did to the margin. Re-derive from current Lulu
 * quotes before moving any of them, and check the whole book rather than one
 * chapter: the marginal margin on a single chapter at $3.99 is 46%, which the
 * base and the earlier chapters carry until they cannot.
 */
export type ChapterTier = {
  id: "keepsake" | "chronicle" | "archive";
  name: string;
  /** First chapter number priced at this rate, 1-based and inclusive. */
  fromChapter: number;
  /** Last chapter number priced at this rate, inclusive. */
  toChapter: number;
  /** What each chapter in the band adds. Zero where the base price covers it. */
  ratePerChapter: number;
  /** One line on who the band is for. */
  blurb: string;
};

export const CHAPTER_TIERS: readonly ChapterTier[] = [
  {
    id: "keepsake",
    name: "Keepsake",
    fromChapter: 1,
    toChapter: BASE_CHAPTERS,
    ratePerChapter: 0,
    blurb: "Their life in five chapters. Everything the base price covers.",
  },
  {
    id: "chronicle",
    name: "Chronicle",
    fromChapter: BASE_CHAPTERS + 1,
    toChapter: 12,
    ratePerChapter: 4.99,
    blurb: "Room for the years in between, told one at a time.",
  },
  {
    id: "archive",
    name: "Archive",
    fromChapter: 13,
    toChapter: MAX_CHAPTERS,
    ratePerChapter: 3.99,
    blurb: "A long life at full length, nothing left in the folder.",
  },
] as const;

/**
 * The print margin the rates are meant to clear, as a fraction of price.
 *
 * Not enforced by the pricing functions — it is a floor the rates were
 * checked against, and the test beside it says where they currently sit
 * relative to it.
 */
export const MARGIN_FLOOR = 0.51;

/** Lulu's print cost for a book of this many chapters, from the quotes. */
export function printCost(chapterCount: number): number {
  return round2(11.84 + 2.148 * chapterCount);
}

/** What a book of this length keeps, as a fraction of its price. */
export function printMargin(chapterCount: number): number {
  const price = bookPrice(chapterCount);
  return (price - printCost(chapterCount)) / price;
}

/** How many of a book's chapters fall inside this band. */
export function chaptersInTier(tier: ChapterTier, chapterCount: number): number {
  return clamp(chapterCount - tier.fromChapter + 1, 0, tier.toChapter - tier.fromChapter + 1);
}

export type PriceLine = {
  tier: ChapterTier;
  chapters: number;
  ratePerChapter: number;
  subtotal: number;
  /** The base price covers these chapters; the rate is not what was charged. */
  includedInBase: boolean;
};

/**
 * The book's price, band by band — what the invoice prints so the customer
 * can see the rate they were charged rather than one total to take on faith.
 * Bands the book never reaches are left out.
 */
export function priceBreakdown(chapterCount: number): PriceLine[] {
  const chapters = clamp(Math.floor(chapterCount), 0, MAX_CHAPTERS);
  return CHAPTER_TIERS.map((tier) => {
    const count = chaptersInTier(tier, chapters);
    const includedInBase = tier.ratePerChapter === 0;
    return {
      tier,
      chapters: count,
      ratePerChapter: tier.ratePerChapter,
      subtotal: includedInBase ? BASE_PRICE : round2(count * tier.ratePerChapter),
      includedInBase,
    };
  }).filter((line) => line.chapters > 0);
}

/**
 * The bands behind a price that was quoted earlier and stored on the order.
 *
 * Rates can change, and a receipt must never explain an old total with
 * today's numbers — so the bands are offered only while they still add up to
 * what was actually charged. Anything else, and the total stands alone.
 */
export function storedPriceBreakdown(
  chapterCount: number,
  chargedPrice: number,
): PriceLine[] {
  const lines = priceBreakdown(chapterCount);
  const sum = round2(lines.reduce((total, line) => total + line.subtotal, 0));
  return sum === round2(chargedPrice) ? lines : [];
}

/** The band the last chapter of this book falls in. */
export function tierForChapterCount(chapterCount: number): ChapterTier {
  const chapters = clamp(Math.floor(chapterCount), BASE_CHAPTERS, MAX_CHAPTERS);
  return (
    CHAPTER_TIERS.find((tier) => chapters <= tier.toChapter) ?? CHAPTER_TIERS.at(-1)!
  );
}

/** Photographs an album needs before this band can be offered at all. */
export function photosForTier(tier: ChapterTier): number {
  return Math.max(tier.fromChapter, BASE_CHAPTERS) * MIN_PHOTOS_PER_CHAPTER;
}

/** Whether an album of this many usable photographs can fill the band. */
export function tierIsAvailable(tier: ChapterTier, usablePhotoCount: number): boolean {
  return maxSupportedChapters(usablePhotoCount) >= tier.fromChapter;
}

/**
 * How long a book to make inside a band.
 *
 * The band is a range, not a length: what decides the length inside it is
 * how much life there is to tell — `chaptersForSpan` — held to the band the
 * customer picked and to what their photographs can actually fill.
 */
export function chaptersForTier(
  tier: ChapterTier,
  args: { wantedChapters: number; usablePhotoCount: number },
): number {
  const supported = maxSupportedChapters(args.usablePhotoCount);
  const top = Math.min(tier.toChapter, Math.max(supported, BASE_CHAPTERS));
  return clamp(args.wantedChapters, Math.max(tier.fromChapter, BASE_CHAPTERS), top);
}

const MS_PER_YEAR = 365.2425 * 24 * 60 * 60 * 1000;

/**
 * A chapter for every year between the first photograph and the last.
 *
 * The album's own span is the only honest guess at how long the book wants
 * to be: a puppy's first eighteen months and a dog of sixteen years are not
 * the same book, and nothing else we have at this point says which one is on
 * the table. Never fewer than the smallest book we print, never more than
 * the longest we bind.
 */
export function chaptersForSpan(
  firstAt: number | null,
  lastAt: number | null,
): number {
  if (firstAt === null || lastAt === null || lastAt < firstAt) return BASE_CHAPTERS;
  const years = Math.ceil((lastAt - firstAt) / MS_PER_YEAR);
  return clamp(years, BASE_CHAPTERS, MAX_CHAPTERS);
}

/** The band we put in front of the customer first, and why. */
export function recommendedTier(args: {
  firstAt: number | null;
  lastAt: number | null;
  usablePhotoCount: number;
}): ChapterTier {
  const wanted = Math.min(
    chaptersForSpan(args.firstAt, args.lastAt),
    maxSupportedChapters(args.usablePhotoCount),
  );
  return tierForChapterCount(wanted);
}

export function bookPrice(chapterCount: number): number {
  const chapters = clamp(Math.floor(chapterCount), BASE_CHAPTERS, MAX_CHAPTERS);
  const extra = CHAPTER_TIERS.reduce(
    (sum, tier) => sum + chaptersInTier(tier, chapters) * tier.ratePerChapter,
    0,
  );
  return round2(BASE_PRICE + extra);
}

/** What a book at this band's shortest and longest length costs. */
export function tierPriceRange(tier: ChapterTier): { min: number; max: number } {
  return {
    min: bookPrice(Math.max(tier.fromChapter, BASE_CHAPTERS)),
    max: bookPrice(tier.toChapter),
  };
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
