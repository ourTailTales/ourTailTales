import { MAX_PHOTOS_PER_PAGE } from "@/lib/book/layouts";
import {
  MAX_STORY_PAGES_PER_CHAPTER,
  MIN_STORY_PAGES_PER_CHAPTER,
} from "@/lib/pricing";
import type { PhotoAsset } from "@/types/photo";

/**
 * How a chapter's photographs are dealt onto its pages.
 *
 * Two rules the whole book rests on:
 *
 * 1. **A chapter is as long as its photographs are worth**, between three
 *    and ten pages. Twenty-five photographs across five chapters is five to
 *    a chapter, and five pages of one photograph each is the right book for
 *    that album — not nine thin pages and five empty ones.
 * 2. **Photographs share a page because they belong together**: the same
 *    afternoon, the same place, the same outing. Only when a chapter has
 *    more photographs than it has pages do any of them share at all, and
 *    then the ones that share are the ones taken closest together.
 *
 * The grouping is decided once, when the chapter is written — by the model
 * where it offered one (`Chapter.pagePlan`), and by `planPages` here where
 * it did not. Everything afterwards reconciles against that plan rather
 * than re-dealing it, so editing one page never rearranges the rest.
 */

/** Pages a chapter's photographs may be spread over, the opener aside. */
export const MIN_PHOTO_PAGES = MIN_STORY_PAGES_PER_CHAPTER - 1;
export const MAX_PHOTO_PAGES = MAX_STORY_PAGES_PER_CHAPTER - 1;

/** The most photographs the book will put on a page by itself. */
export const AUTO_MAX_PER_PAGE = 4;

export type PlannablePhoto = {
  id: string;
  capturedAt?: number | null;
  lat?: number;
  lng?: number;
};

export function photoFactsOf(photo: PhotoAsset): PlannablePhoto {
  return { id: photo.id, capturedAt: photo.capturedAt, lat: photo.lat, lng: photo.lng };
}

/**
 * Groups a chapter's photographs onto pages by what they have in common.
 *
 * Starts with one photograph to a page — which is the whole answer for a
 * chapter with few — and while there are more pages than the chapter may
 * have, merges the two neighbouring pages whose photographs have the most in
 * common: taken minutes apart, in the same place. The last merges are the
 * ones between one afternoon and the next, so a page almost never straddles
 * two occasions.
 */
export function planPages(photos: readonly PlannablePhoto[]): string[][] {
  if (photos.length === 0) return [];
  const pages = photos.map((photo) => [photo]);
  const maxPages = Math.min(MAX_PHOTO_PAGES, Math.max(MIN_PHOTO_PAGES, photos.length));

  while (pages.length > maxPages) {
    let bestAt = -1;
    let bestDistance = Infinity;
    for (let index = 0; index < pages.length - 1; index += 1) {
      const left = pages[index]!;
      const right = pages[index + 1]!;
      if (left.length + right.length > pageCap(photos.length)) continue;
      const distance = apartness(left.at(-1)!, right[0]!) + (left.length + right.length) * 0.35;
      if (distance < bestDistance) {
        bestDistance = distance;
        bestAt = index;
      }
    }
    // Every neighbouring pair is already as full as a page may be.
    if (bestAt === -1) break;
    pages.splice(bestAt, 2, [...pages[bestAt]!, ...pages[bestAt + 1]!]);
  }

  // Merging in pairs can settle at, say, ten pages of four when nine pages
  // of four and five would do. A chapter that big has more photographs than
  // occasions anyway, so it is dealt evenly, in order, instead.
  if (pages.length > maxPages) return evenGroups(photos, maxPages);

  return pages.map((page) => page.map((photo) => photo.id));
}

/** The photographs in order, split into `count` groups of as even a size as possible. */
function evenGroups(photos: readonly PlannablePhoto[], count: number): string[][] {
  const groups: string[][] = [];
  const base = Math.floor(photos.length / count);
  let remainder = photos.length % count;
  let cursor = 0;
  for (let index = 0; index < count && cursor < photos.length; index += 1) {
    const size = Math.max(1, base + (remainder > 0 ? 1 : 0));
    if (remainder > 0) remainder -= 1;
    groups.push(photos.slice(cursor, cursor + size).map((photo) => photo.id));
    cursor += size;
  }
  // Anything past what the pages can hold stays with the last one; the book
  // caps a page at six and leaves the rest out.
  if (cursor < photos.length) {
    groups[groups.length - 1]!.push(...photos.slice(cursor).map((photo) => photo.id));
  }
  return groups;
}

/**
 * How many photographs may share a page.
 *
 * Four of the book's own accord, and only as many more as a chapter with a
 * great many photographs needs to fit them into the pages it has. Six is the
 * most any page holds; past that the chapter simply runs longer than its
 * pages and the extras stay out of the book.
 */
function pageCap(total: number): number {
  const needed = Math.ceil(total / MAX_PHOTO_PAGES);
  return Math.min(MAX_PHOTOS_PER_PAGE, Math.max(AUTO_MAX_PER_PAGE, needed));
}

/**
 * How little two photographs have in common: hours apart, and how far apart
 * they were taken. Undated photographs are treated as a day apart, which is
 * enough to keep them from being merged ahead of a real burst.
 */
function apartness(left: PlannablePhoto, right: PlannablePhoto): number {
  const hours =
    left.capturedAt && right.capturedAt
      ? Math.abs(right.capturedAt - left.capturedAt) / 3_600_000
      : 24;
  const km = kmBetween(left, right);
  return Math.log1p(hours) + Math.log1p(km) * 0.6;
}

function kmBetween(a: PlannablePhoto, b: PlannablePhoto): number {
  if (a.lat === undefined || a.lng === undefined || b.lat === undefined || b.lng === undefined) {
    return 0;
  }
  const R = 6371;
  const toRad = (degrees: number): number => (degrees * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Turns what a model returned into a plan the book can print: positions into
 * the chapter's own photo list, every photograph on exactly one page, no page
 * over the limit, no more pages than a chapter may have.
 *
 * Anything it left out is added back rather than dropped — a photograph the
 * customer chose is never lost to a model's arithmetic.
 */
export function planFromIndexes(
  photoIds: readonly string[],
  indexes: readonly (readonly number[])[] | undefined,
): string[][] | null {
  if (!indexes || indexes.length === 0 || photoIds.length === 0) return null;

  const used = new Set<number>();
  const pages: string[][] = [];
  for (const group of indexes) {
    const page: string[] = [];
    for (const index of group) {
      if (!Number.isInteger(index) || index < 0 || index >= photoIds.length) continue;
      if (used.has(index)) continue;
      if (page.length >= MAX_PHOTOS_PER_PAGE) break;
      used.add(index);
      page.push(photoIds[index]!);
    }
    if (page.length > 0) pages.push(page);
  }
  if (pages.length === 0) return null;

  const missing = photoIds.filter((_, index) => !used.has(index));
  return reconcile(pages, [...photoIds], missing);
}

/**
 * Brings a saved plan back in line with the chapter as it is now: photographs
 * that have left are removed, ones that have arrived join the page nearest
 * where they sit in the chapter, and the page count is brought inside its
 * bounds. Returns null when nothing usable is left.
 */
export function reconcilePlan(
  plan: readonly (readonly string[])[] | undefined,
  photoIds: readonly string[],
): string[][] | null {
  if (!plan || plan.length === 0) return null;
  const present = new Set(photoIds);
  const seen = new Set<string>();
  const pages: string[][] = [];

  for (const page of plan) {
    const kept = page.filter((id) => present.has(id) && !seen.has(id));
    for (const id of kept) seen.add(id);
    if (kept.length > 0) pages.push(kept.slice(0, MAX_PHOTOS_PER_PAGE));
  }
  if (pages.length === 0) return null;

  return reconcile(
    pages,
    [...photoIds],
    photoIds.filter((id) => !seen.has(id)),
  );
}

/** Adds what the plan left out, then trims it to the pages a chapter may have. */
function reconcile(pages: string[][], order: string[], missing: string[]): string[][] {
  const positionOf = new Map(order.map((id, index) => [id, index]));
  for (const id of missing) {
    const at = positionOf.get(id) ?? 0;
    // Onto the page it sits nearest in the chapter, or a page of its own
    // when that one is already full.
    const nearest = pages.reduce(
      (best, page, index) => {
        const distance = Math.min(
          ...page.map((other) => Math.abs((positionOf.get(other) ?? 0) - at)),
        );
        return distance < best.distance ? { index, distance } : best;
      },
      { index: 0, distance: Infinity },
    );
    const page = pages[nearest.index]!;
    if (page.length < AUTO_MAX_PER_PAGE) page.push(id);
    else pages.splice(nearest.index + 1, 0, [id]);
  }

  // Pages stay in the order their photographs fall in the chapter.
  pages.sort(
    (a, b) => (positionOf.get(a[0]!) ?? 0) - (positionOf.get(b[0]!) ?? 0),
  );
  for (const page of pages) {
    page.sort((a, b) => (positionOf.get(a) ?? 0) - (positionOf.get(b) ?? 0));
  }

  while (pages.length > MAX_PHOTO_PAGES) {
    // Merge the smallest neighbouring pair rather than dropping anything.
    let bestAt = 0;
    let bestSize = Infinity;
    for (let index = 0; index < pages.length - 1; index += 1) {
      const size = pages[index]!.length + pages[index + 1]!.length;
      if (size < bestSize && size <= MAX_PHOTOS_PER_PAGE) {
        bestSize = size;
        bestAt = index;
      }
    }
    if (bestSize === Infinity) break;
    pages.splice(bestAt, 2, [...pages[bestAt]!, ...pages[bestAt + 1]!]);
  }

  // A chapter shorter than its minimum spreads out rather than pads: the
  // fullest page gives one back until there are enough pages, and a chapter
  // with too few photographs to reach the minimum stays short.
  while (pages.length < MIN_PHOTO_PAGES && pages.some((page) => page.length > 1)) {
    const fullest = pages.reduce(
      (best, page, index) => (page.length > pages[best]!.length ? index : best),
      0,
    );
    const page = pages[fullest]!;
    pages.splice(fullest + 1, 0, [page.pop()!]);
  }

  return pages;
}
