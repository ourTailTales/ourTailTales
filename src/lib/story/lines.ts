/**
 * Comparing two printed lines, with nothing else in the file.
 *
 * Kept apart from `lib/story/guard` so the browser can use the same
 * comparison the server does (`Funnel` checks a chapter's captions against
 * the ones that finished while it was being written) without importing the
 * prompts, the examples or anything that only runs on the server. No imports
 * at all, and it should stay that way.
 */

/** Lower case, no punctuation, no accents, single spaces. */
export function normalizeLine(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/['’‘`]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** The words of a line once it is normalised. */
export function wordsOf(text: string): string[] {
  const normal = normalizeLine(text);
  return normal ? normal.split(" ") : [];
}

/**
 * Whether two lines of one book are the same line: identical once case,
 * punctuation and accents are gone, and nothing looser than that.
 *
 * Deliberately exact. A book about one animal says "Summer at the lake" and
 * then, honestly, "Winter at the lake"; "Two days at the coast" and "Three
 * days at the coast". Anything that treats those as repeats costs a page its
 * line for telling the truth. The looser comparison is kept for the prompts'
 * own examples (`matchesExample` in the guard), where a near-copy is a copy.
 */
export function sameLine(a: string, b: string): boolean {
  const first = normalizeLine(a);
  return first !== "" && first === normalizeLine(b);
}

type CaptionedPage = { photos: number[]; caption?: string };

/**
 * A chapter's pages with every caption the book already has taken off.
 *
 * Two chapters are written at once and neither can see the other's lines, so
 * the one that finishes second is checked again here, against what the store
 * holds by then. Its duplicate captions are dropped — the page keeps its
 * photographs and prints its date — and so is a line it repeats itself.
 * Titles are not touched: a repeated title is better than "Chapter 7".
 */
export function withoutUsedCaptions<Story extends { pages?: CaptionedPage[] }>(
  story: Story,
  usedCaptions: readonly string[],
): Story {
  if (!story.pages) return story;
  const taken = new Set(usedCaptions.map(normalizeLine).filter(Boolean));
  let changed = false;
  const pages = story.pages.map((page): CaptionedPage => {
    const key = page.caption ? normalizeLine(page.caption) : "";
    if (!key) return page;
    if (taken.has(key)) {
      changed = true;
      return { photos: page.photos };
    }
    taken.add(key);
    return page;
  });
  return changed ? { ...story, pages } : story;
}
