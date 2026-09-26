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

/**
 * A band of chapters and what each chapter inside it costs.
 *
 * Books are priced by the chapter, and the chapter gets cheaper the longer
 * the book runs. The bands are *progressive*, the way income tax brackets
 * are: a twelve-chapter book pays the Keepsake rate on its first nine
 * chapters and the Chronicle rate on the three after that. It is not a flat
 * rate chosen by the book's total length — that version makes a twenty-
 * chapter book cost less than a nineteen-chapter one, and an invoice that
 * charges more for less is one nobody trusts twice.
 *
 * What a chapter holds does not change between bands: every chapter in every
 * book runs `MIN_STORY_PAGES_PER_CHAPTER`–`MAX_STORY_PAGES_PER_CHAPTER` pages
 * and takes `PHOTOS_PER_CHAPTER_TARGET` photographs. The tiers buy length,
 * not richness.
 */
export type ChapterTier = {
  id: "keepsake" | "chronicle" | "archive";
  name: string;
  /** First chapter number priced at this rate, 1-based and inclusive. */
  fromChapter: number;
  /** Last chapter number priced at this rate, inclusive. */
  toChapter: number;
  ratePerChapter: number;
  /** One line on who the band is for, for the pricing table. */
  blurb: string;
};

export const CHAPTER_TIERS: readonly ChapterTier[] = [
  {
    id: "keepsake",
    name: "Keepsake",
    fromChapter: 1,
    toChapter: 9,
    ratePerChapter: 9.99,
    blurb: "One life, told once through. Where every book starts.",
  },
  {
    id: "chronicle",
    name: "Chronicle",
    fromChapter: 10,
    toChapter: 24,
    ratePerChapter: 7.99,
    blurb: "A full decade of them, year by year.",
  },
  {
    id: "archive",
    name: "Archive",
    fromChapter: 25,
    toChapter: 50,
    ratePerChapter: 5.99,
    blurb: "The whole album, nothing left in the folder.",
  },
] as const;

/** How many of a book's chapters fall inside this band. */
export function chaptersInTier(tier: ChapterTier, chapterCount: number): number {
  return clamp(chapterCount - tier.fromChapter + 1, 0, tier.toChapter - tier.fromChapter + 1);
}

export type PriceLine = {
  tier: ChapterTier;
  chapters: number;
  ratePerChapter: number;
  subtotal: number;
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
    return {
      tier,
      chapters: count,
      ratePerChapter: tier.ratePerChapter,
      subtotal: round2(count * tier.ratePerChapter),
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

/** What a book of this band's shortest and longest length costs. */
export function tierPriceRange(tier: ChapterTier): { min: number; max: number } {
  return {
    min: bookPrice(Math.max(tier.fromChapter, BASE_CHAPTERS)),
    max: bookPrice(tier.toChapter),
  };
}

export function bookPrice(chapterCount: number): number {
  const chapters = clamp(Math.floor(chapterCount), 0, MAX_CHAPTERS);
  const total = CHAPTER_TIERS.reduce(
    (sum, tier) => sum + chaptersInTier(tier, chapters) * tier.ratePerChapter,
    0,
  );
  return round2(total);
}

/** The headline price: the shortest book we print. */
export const BASE_PRICE = bookPrice(BASE_CHAPTERS);

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
