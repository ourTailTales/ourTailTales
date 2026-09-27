import { MAX_PHOTOS_PER_PAGE } from "@/lib/book/layouts";
import {
  MAX_STORY_PAGES_PER_CHAPTER,
  MIN_STORY_PAGES_PER_CHAPTER,
} from "@/lib/pricing";
import type { PlannedPage } from "@/types/book";
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
export function planPages(photos: readonly PlannablePhoto[]): PlannedPage[] {
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

  return pages.map((page) => ({ photos: page.map((photo) => photo.id) }));
}

/** The photographs in order, split into `count` groups of as even a size as possible. */
function evenGroups(photos: readonly PlannablePhoto[], count: number): PlannedPage[] {
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
  return groups.map((photos) => ({ photos }));
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
  planned: readonly { photos?: readonly number[]; caption?: string }[] | undefined,
): PlannedPage[] | null {
  if (!planned || planned.length === 0 || photoIds.length === 0) return null;

  const offset = numberingOffset(planned, photoIds.length);
  const used = new Set<number>();
  const pages: PlannedPage[] = [];
  for (const group of planned) {
    const photos: string[] = [];
    for (const raw of group.photos ?? []) {
      const index = raw - offset;
      if (!Number.isInteger(index) || index < 0 || index >= photoIds.length) continue;
      if (used.has(index)) continue;
      if (photos.length >= MAX_PHOTOS_PER_PAGE) break;
      used.add(index);
      photos.push(photoIds[index]!);
    }
    if (photos.length > 0) pages.push({ photos, ...withCaption(group, photos) });
  }
  if (pages.length === 0) return null;

  const missing = photoIds.filter((_, index) => !used.has(index));
  return reconcile(pages, [...photoIds], missing);
}

/**
 * Whether the model counted the photographs from one or from zero.
 *
 * This is the difference between a line printed under the picture it was
 * written about and a line printed under the next one along — a page of a dog
 * indoors captioned "Out into the sunny green yard", because the yard was the
 * photograph before it. The prompt now numbers them from one, which is how a
 * list reads and how a model counts, but a model that answers in the other
 * base must not silently shift the whole chapter by one.
 *
 * Two things settle it outright: a zero can only be zero-based, and a number
 * as high as the count can only be one-based. The second is checked first and
 * wins outright when both appear — a single stray zero (the model slipping on
 * one group while numbering the rest correctly from one, or a group it wrote
 * as covering "photo 0" it never should have) must not silently shift every
 * other, unambiguous group in the chapter to the wrong photograph. With
 * neither signal present — a chapter whose first photograph the model left
 * out entirely — the prompt's own numbering decides.
 */
function numberingOffset(
  planned: readonly { photos?: readonly number[] }[],
  photoCount: number,
): number {
  const numbers = planned
    .flatMap((group) => group.photos ?? [])
    .filter((value) => Number.isInteger(value) && value >= 0);
  if (numbers.length === 0) return 0;
  // A number as high as the count is past the end of a zero-based list, so it
  // can only be one-based — checked first because it is decisive evidence,
  // and one stray zero elsewhere must not outweigh it.
  if (numbers.includes(photoCount)) return 1;
  // A zero can only be zero-based.
  if (numbers.includes(0)) return 0;
  // Neither signal fired: the prompt's own numbering, which is what was asked
  // for.
  return 1;
}

/**
 * A caption the model wrote, trimmed, together with the photographs it was
 * written about — or nothing, rather than an empty line.
 *
 * The two are only ever set together, which is what keeps a line from
 * outliving the pictures it describes: anything downstream that has the
 * caption also has the evidence for whether it still belongs.
 */
function withCaption(
  page: { caption?: string; captionFor?: readonly string[] },
  photos: readonly string[],
): Pick<PlannedPage, "caption" | "captionFor"> {
  const text = page.caption?.trim();
  if (!text) return {};
  // Plans saved before the set was kept anchor on the page as it was stored,
  // which is the same thing one version of the book ago.
  const written = page.captionFor?.length ? page.captionFor : photos;
  return { caption: text.slice(0, MAX_CAPTION_LENGTH), captionFor: [...written] };
}

/** The most a written-for-you caption may run to. Past this it is a paragraph. */
export const MAX_CAPTION_LENGTH = 120;

/**
 * A chapter's pages, ready to print: the photographs on each one and the line
 * that belongs with them.
 *
 * `leftover` is what no page had room for — photographs that arrived after
 * the plan was made and could not be fitted into the pages a chapter may
 * have. They stay in the album; they are simply not on a page.
 */
export type ChapterLayout = {
  pages: PlannedPage[];
  leftover: string[];
};

/**
 * Brings a chapter's plan in line with the layouts its owner chose.
 *
 * This is the whole of how a chapter is dealt onto pages, and it is dealt
 * from the plan itself: page one *is* the plan's first group, photographs and
 * line together. The book used to do it the other way round — count how many
 * photographs each page should hold, slice that many off the chapter's list,
 * then go looking through the plan for a line that might suit them. Two
 * groupings, agreeing only by arithmetic, and the moment they disagreed the
 * book printed "Watching from the cushions in March" under three photographs
 * of a dog on a lawn with a football. Nothing here can produce that, because
 * there is only ever one grouping.
 *
 * `capacities` is the one thing that moves photographs between pages: a page
 * whose owner chose a layout holds exactly what that layout has room for, no
 * more and no fewer. Photographs it sheds go to the front of the next page,
 * ones it needs come from the front of the next page that has any, and a line
 * left standing over a page that is no longer mostly its own photographs is
 * dropped rather than printed over the wrong picture.
 */
export function fitPlanToPages(
  plan: readonly PlannedPage[],
  capacities: readonly (number | null)[] = [],
): ChapterLayout {
  const pages: PlannedPage[] = plan.map((page) => ({ ...page, photos: [...page.photos] }));
  const leftover: string[] = [];

  // A page claimed by a chosen layout exists even where the plan never
  // reached it, or the chapter would have nowhere to honour the choice.
  const lastChosen = capacities.reduce<number>(
    (last, size, index) => (size ? index : last),
    -1,
  );
  while (pages.length <= lastChosen && pages.length < MAX_PHOTO_PAGES) {
    pages.push({ photos: [] });
  }

  /**
   * A photograph the page before it could not keep. Onto the next page, or
   * onto a new one — and once the chapter has every page it is allowed, out
   * of the book: there is nowhere left that is not the page it just left.
   */
  const pushDown = (target: number, id: string): void => {
    const next = pages[target];
    if (next) {
      next.photos.unshift(id);
      return;
    }
    if (pages.length < MAX_PHOTO_PAGES) {
      pages.push({ photos: [id] });
      return;
    }
    leftover.unshift(id);
  };

  // Forwards, once: a page is filled from the pages after it, then sheds
  // whatever it cannot hold onto the page after it, which the next turn of
  // the loop settles in turn. Nothing ever moves backwards, so a page already
  // passed is never reopened and the pass cannot cycle.
  for (let index = 0; index < pages.length; index += 1) {
    const page = pages[index]!;
    const wanted = capacities[index];
    const room = wanted ? Math.min(wanted, MAX_PHOTOS_PER_PAGE) : MAX_PHOTOS_PER_PAGE;
    if (wanted) {
      while (page.photos.length < room) {
        const from = pages.find((other, at) => at > index && other.photos.length > 0);
        if (!from) break;
        page.photos.push(from.photos.shift()!);
      }
      // Nothing left after it. A page its owner claimed is honoured out of
      // the pages before it — nearest first, so the photographs that join it
      // are the ones it already sat next to — rather than quietly handed back
      // a layout they did not ask for. Pages they chose themselves are left
      // alone: one choice does not overrule another.
      for (let at = index - 1; at >= 0 && page.photos.length < room; at -= 1) {
        if (capacities[at]) continue;
        const donor = pages[at]!;
        while (donor.photos.length > 0 && page.photos.length < room) {
          page.photos.unshift(donor.photos.pop()!);
        }
      }
    }
    while (page.photos.length > room) pushDown(index + 1, page.photos.pop()!);
  }

  return {
    pages: pages.map((page) => ({
      photos: page.photos,
      ...(captionBelongsOn(page)
        ? { caption: page.caption, captionFor: page.captionFor }
        : {}),
    })),
    leftover,
  };
}

/**
 * Whether a page's line is still about the page.
 *
 * Most of the page has to be photographs the line was written about, and most
 * of what it was written about has to be on the page. Either half alone lets
 * a real mistake through: one photograph in common hands a page of four a
 * line about a single unrelated afternoon, and a six-photograph page cut down
 * to one keeps a line about all six. A page that cannot pass keeps no line at
 * all and prints its date instead, which is always true.
 */
export function captionBelongsOn(page: PlannedPage): boolean {
  if (!page.caption?.trim() || page.photos.length === 0) return false;
  const written = page.captionFor?.length ? page.captionFor : page.photos;
  const shared = page.photos.reduce(
    (count, id) => (written.includes(id) ? count + 1 : count),
    0,
  );
  return shared * 2 > page.photos.length && shared * 2 > written.length;
}

/**
 * Brings a saved plan back in line with the chapter as it is now: photographs
 * that have left are removed, ones that have arrived join the page nearest
 * where they sit in the chapter, and the page count is brought inside its
 * bounds. Returns null when nothing usable is left.
 */
export function reconcilePlan(
  plan: readonly (PlannedPage | readonly string[])[] | undefined,
  photoIds: readonly string[],
): PlannedPage[] | null {
  if (!plan || plan.length === 0) return null;
  const present = new Set(photoIds);
  const seen = new Set<string>();
  const pages: PlannedPage[] = [];

  for (const entry of plan) {
    // Plans saved before pages carried a caption are plain lists of ids.
    const page: PlannedPage = Array.isArray(entry)
      ? { photos: entry as string[] }
      : (entry as PlannedPage);
    const kept = (page.photos ?? []).filter((id) => present.has(id) && !seen.has(id));
    for (const id of kept) seen.add(id);
    if (kept.length > 0) {
      // Anchored on the page as it was stored, not on what survived the
      // filter: a line written about four photographs is still a line about
      // four photographs after two of them leave the chapter.
      pages.push({
        photos: kept.slice(0, MAX_PHOTOS_PER_PAGE),
        ...withCaption(page, page.photos ?? []),
      });
    }
  }
  if (pages.length === 0) return null;

  return reconcile(
    pages,
    [...photoIds],
    photoIds.filter((id) => !seen.has(id)),
  );
}

/** Adds what the plan left out, then trims it to the pages a chapter may have. */
function reconcile(
  pages: PlannedPage[],
  order: string[],
  missing: string[],
): PlannedPage[] {
  const positionOf = new Map(order.map((id, index) => [id, index]));
  const placeOf = (page: PlannedPage): number =>
    Math.min(...page.photos.map((id) => positionOf.get(id) ?? 0));

  for (const id of missing) {
    const at = positionOf.get(id) ?? 0;
    // Onto the page it sits nearest in the chapter, or a page of its own
    // when that one is already full.
    const nearest = pages.reduce(
      (best, page, index) => {
        const distance = Math.min(
          ...page.photos.map((other) => Math.abs((positionOf.get(other) ?? 0) - at)),
        );
        return distance < best.distance ? { index, distance } : best;
      },
      { index: 0, distance: Infinity },
    );
    const page = pages[nearest.index]!;
    if (page.photos.length < AUTO_MAX_PER_PAGE) page.photos.push(id);
    else pages.splice(nearest.index + 1, 0, { photos: [id] });
  }

  // Pages stay in the order their photographs fall in the chapter.
  pages.sort((a, b) => placeOf(a) - placeOf(b));
  for (const page of pages) {
    page.photos.sort((a, b) => (positionOf.get(a) ?? 0) - (positionOf.get(b) ?? 0));
  }

  while (pages.length > MAX_PHOTO_PAGES) {
    // Merge the smallest neighbouring pair rather than dropping anything.
    let bestAt = 0;
    let bestSize = Infinity;
    for (let index = 0; index < pages.length - 1; index += 1) {
      const size = pages[index]!.photos.length + pages[index + 1]!.photos.length;
      if (size < bestSize && size <= MAX_PHOTOS_PER_PAGE) {
        bestSize = size;
        bestAt = index;
      }
    }
    if (bestSize === Infinity) break;
    const left = pages[bestAt]!;
    const right = pages[bestAt + 1]!;
    // The surviving line is the first one written: a merged page says one
    // thing, not two. It keeps its own photographs with it, so a merge that
    // buries them under a second group's is caught before it is printed.
    const keeper = left.caption ? left : right;
    pages.splice(bestAt, 2, {
      photos: [...left.photos, ...right.photos],
      ...withCaption(keeper, keeper.photos),
    });
  }

  // A chapter shorter than its minimum spreads out rather than pads: the
  // fullest page gives one back until there are enough pages, and a chapter
  // with too few photographs to reach the minimum stays short.
  while (pages.length < MIN_PHOTO_PAGES && pages.some((page) => page.photos.length > 1)) {
    const fullest = pages.reduce(
      (best, page, index) => (page.photos.length > pages[best]!.photos.length ? index : best),
      0,
    );
    const page = pages[fullest]!;
    pages.splice(fullest + 1, 0, { photos: [page.photos.pop()!] });
  }

  return pages;
}
