import {
  PROMPT_EXAMPLE_CAPTIONS,
  PROMPT_EXAMPLE_OPENINGS,
  PROMPT_EXAMPLE_TITLES,
} from "@/lib/ai/examples";
import { guessesTheSex, ownerPronoun } from "@/lib/ai/prompt";
import type { GenerateOptions, StoryProvider } from "@/lib/ai/provider";
import { normalizeLine, sameLine, wordsOf } from "@/lib/story/lines";
import type { PlannedStoryPage, StoryDraft, StoryRequest } from "@/types/story";

// The comparison itself lives in `lib/story/lines`, which imports nothing, so
// the browser can share it. Re-exported for the callers that already read it
// from here.
export { normalizeLine, sameLine };

/**
 * The check on what the model wrote, after it wrote it.
 *
 * The instructions tell the model not to hand their own examples back, not to
 * repeat a line, and not to guess whether the animal is a he or a she. A
 * model told that still does all three some of the time, and this text is
 * printed. So nothing here trusts the instruction: every title, introduction
 * and caption is compared against the lines the prompts quote
 * (`lib/ai/examples`, the same constants the prompts are built from) and
 * against what the book has already used.
 *
 * The two comparisons are not the same strength. Against the prompts'
 * examples a near-copy is a copy (`matchesExample`). Against the book's own
 * lines only an identical line is a repeat (`sameLine`): a book about one
 * animal says "Summer at the lake" and later, truthfully, "Winter at the
 * lake", and losing the second for resembling the first is a worse page than
 * the resemblance.
 *
 * What happens to a line that fails depends on what it costs to lose it:
 *
 * - A page caption is dropped. The page keeps its photographs and prints the
 *   month they were taken, which is the book's ordinary behaviour for a page
 *   nobody wrote a line for.
 * - A title or an introduction that copies an example, or calls the animal he
 *   or she without being told, is asked for once more with the reason named.
 *   If the second is refused as well it comes back empty, and the chapter
 *   keeps the title and (blank) introduction it was created with — the same
 *   thing that happens to any field the model leaves out.
 * - A title another chapter already has is asked for once more and then kept
 *   whatever comes back: the alternative is "Chapter 7", which two of the
 *   designs print directly under "Chapter Seven".
 * - A date label naming a year the chapter's photographs are not from comes
 *   back empty, and the chapter keeps the label worked out from its dates.
 */

/** Whether `needle` appears in `haystack` as a run of whole words. */
function containsRun(haystack: readonly string[], needle: readonly string[]): boolean {
  if (needle.length === 0 || needle.length > haystack.length) return false;
  for (let start = 0; start + needle.length <= haystack.length; start += 1) {
    let same = true;
    for (let offset = 0; offset < needle.length; offset += 1) {
      if (haystack[start + offset] !== needle[offset]) {
        same = false;
        break;
      }
    }
    if (same) return true;
  }
  return false;
}

/** Length of the longest run of words the two share in the same order. */
function sharedInOrder(a: readonly string[], b: readonly string[]): number {
  let previous = new Array<number>(b.length + 1).fill(0);
  for (let i = 1; i <= a.length; i += 1) {
    const current = new Array<number>(b.length + 1).fill(0);
    for (let j = 1; j <= b.length; j += 1) {
      current[j] =
        a[i - 1] === b[j - 1]
          ? previous[j - 1]! + 1
          : Math.max(previous[j]!, current[j - 1]!);
    }
    previous = current;
  }
  return previous[b.length]!;
}

/** A lightly reworded line shares at least this much of the longer one, in order. */
const REWORDED = 0.8;
/**
 * Below this many words in either line, "most of the same words" is true of
 * unrelated lines: "Right by the door" is not "Right by the fireplace".
 */
const MIN_WORDS_FOR_REWORDING = 6;
/** An example shorter than this is too common a phrase to be found inside a line. */
const MIN_WORDS_FOR_CONTAINED_EXAMPLE = 4;

function wordsMatchExample(candidate: readonly string[], example: readonly string[]): boolean {
  if (candidate.length === 0 || example.length === 0) return false;
  if (candidate.length === example.length && containsRun(candidate, example)) return true;
  // The whole example sitting inside the line. Never the other way round: a
  // few honest words ("Back at the lake") are not a copy for turning up
  // inside something longer that the prompts happen to quote.
  if (example.length >= MIN_WORDS_FOR_CONTAINED_EXAMPLE && containsRun(candidate, example)) {
    return true;
  }
  if (Math.min(candidate.length, example.length) < MIN_WORDS_FOR_REWORDING) return false;
  return (
    sharedInOrder(candidate, example) / Math.max(candidate.length, example.length) >= REWORDED
  );
}

/**
 * Whether a line is one of the prompts' examples handed back.
 *
 * The same once case and punctuation are gone; or with a whole example of
 * four words or more inside it; or, for lines of six words or more, the same
 * words in the same order with one or two swapped — "Back at the lake by
 * July" for "…by June".
 */
export function matchesExample(candidate: string, example: string): boolean {
  return wordsMatchExample(wordsOf(candidate), wordsOf(example));
}

function sentencesOf(text: string): string[] {
  return text
    .split(/(?<=[.!?…])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

/** The quoted introductions, and each sentence of them on its own. */
const EXAMPLE_SENTENCES: readonly string[] = [
  ...new Set(PROMPT_EXAMPLE_OPENINGS.flatMap((opening) => [opening, ...sentencesOf(opening)])),
];

/** Everything a title or a caption is compared with: every quoted line. */
const EXAMPLES_FOR_SHORT_LINES: readonly string[] = [
  ...PROMPT_EXAMPLE_TITLES,
  ...PROMPT_EXAMPLE_CAPTIONS,
  ...EXAMPLE_SENTENCES,
];

/** The example a title or caption was taken from, or null if it is its own. */
export function matchedExample(line: string): string | null {
  const words = wordsOf(line);
  if (words.length === 0) return null;
  for (const example of EXAMPLES_FOR_SHORT_LINES) {
    if (wordsMatchExample(words, wordsOf(example))) return example;
  }
  return null;
}

/**
 * The example an introduction leans on, or null.
 *
 * Compared only with the quoted introductions, never with the quoted titles
 * and captions: a paragraph that happens to say "right by the fireplace this
 * year" has not copied anything, and refusing it cost a second request and
 * sometimes the introduction. Read a sentence at a time as well as whole,
 * because that is how it gets copied: one borrowed sentence followed by one
 * of the model's own.
 */
export function matchedExampleInOpening(blurb: string): string | null {
  const whole = wordsOf(blurb);
  if (whole.length === 0) return null;
  const sentences = sentencesOf(blurb).map(wordsOf);
  for (const example of EXAMPLE_SENTENCES) {
    const exampleWords = wordsOf(example);
    if (wordsMatchExample(whole, exampleWords)) return example;
    if (sentences.some((sentence) => wordsMatchExample(sentence, exampleWords))) return example;
  }
  return null;
}

const YEAR = /\b\d{4}\b/g;

/**
 * The model's date label, or "" when it names a year the chapter is not from.
 *
 * The label is printed, and nothing else checks it: a model shown "Spring
 * 2016" in its instructions has written "Spring 2016" over photographs from
 * 2021. The chapter's own years are the ones in the label the book worked out
 * from its dates and in the dates of its photographs. An empty label leaves
 * the chapter with that computed one.
 */
export function supportedDateLabel(
  label: string,
  chapter: Partial<Pick<StoryRequest, "dateLabel" | "photos">>,
): string {
  const named = label.match(YEAR) ?? [];
  if (named.length === 0) return label;
  const known = new Set<string>(chapter.dateLabel?.match(YEAR) ?? []);
  for (const photo of chapter.photos ?? []) {
    const year = photo.on?.slice(0, 4);
    if (year && /^\d{4}$/.test(year)) known.add(year);
  }
  return named.every((year) => known.has(year)) ? label : "";
}

export type DraftCheck = {
  /**
   * The draft with every refused caption removed from its page and an
   * unsupported date label emptied.
   */
  draft: StoryDraft;
  /** The prompt example the title was taken from. Costs the title. */
  titleMatch: string | null;
  /** The earlier chapter's title this one is identical to. Worth a retry, never a blank. */
  titleRepeat: string | null;
  /** The prompt example the introduction leans on. Costs the introduction. */
  blurbMatch: string | null;
  /** The title calls the animal he or she without being told. Costs the title. */
  titleGuess: boolean;
  /** The introduction does. Costs the introduction. */
  blurbGuess: boolean;
  /** Either of the two above. */
  guessedSex: boolean;
  /** How many page captions were dropped, for the tests and the logs. */
  droppedCaptions: number;
};

type CheckedChapter = Partial<
  Pick<StoryRequest, "alreadyUsed" | "notes" | "petName" | "dateLabel" | "photos">
>;

/**
 * Checks one draft against the examples and against the rest of the book.
 *
 * Captions are settled here: the first use of a line stands, and a copy of an
 * example, the same line again within this response, a line an earlier
 * chapter already printed or a guessed "he"/"she" leaves its page without
 * one.
 */
export function checkDraft(draft: StoryDraft, chapter: CheckedChapter): DraftCheck {
  const pronoun = ownerPronoun(chapter.notes, chapter.petName);
  const usedTitles = chapter.alreadyUsed?.titles ?? [];
  const usedCaptions = chapter.alreadyUsed?.captions ?? [];

  const seen: string[] = [];
  let droppedCaptions = 0;
  const pages = draft.pages?.map((page): PlannedStoryPage => {
    const caption = page.caption?.trim();
    if (!caption) return { photos: page.photos };
    const refused =
      matchedExample(caption) !== null ||
      guessesTheSex(caption, pronoun) ||
      seen.some((earlier) => sameLine(earlier, caption)) ||
      usedCaptions.some((earlier) => sameLine(earlier, caption));
    if (refused) {
      droppedCaptions += 1;
      return { photos: page.photos };
    }
    seen.push(caption);
    return { photos: page.photos, caption };
  });

  const titleGuess = guessesTheSex(draft.title, pronoun);
  const blurbGuess = guessesTheSex(draft.blurb, pronoun);

  return {
    draft: {
      ...draft,
      dateLabel: supportedDateLabel(draft.dateLabel, chapter),
      ...(pages ? { pages } : {}),
    },
    titleMatch: matchedExample(draft.title),
    titleRepeat: usedTitles.find((earlier) => sameLine(earlier, draft.title)) ?? null,
    blurbMatch: matchedExampleInOpening(draft.blurb),
    titleGuess,
    blurbGuess,
    guessedSex: titleGuess || blurbGuess,
    droppedCaptions,
  };
}

/**
 * How long a chapter may have been in the writing when a second attempt is
 * still worth starting.
 *
 * The route has sixty seconds. The provider may already have spent two vision
 * calls on the first draft (its own retry for a paragraph that reads like a
 * caption), and a third started late runs into the platform's limit and takes
 * the first draft down with it as a 504. Past this point the first draft is
 * returned in whatever form is printable.
 */
export const RETRY_BUDGET_MS = 25_000;

export type GuardOptions = {
  /** The clock, in milliseconds. Injectable so the budget can be tested. */
  now?: () => number;
  /** Overrides `RETRY_BUDGET_MS`. */
  retryBudgetMs?: number;
};

/**
 * Writes one chapter and refuses to return a line the prompts quoted.
 *
 * At most one extra request, and none once `RETRY_BUDGET_MS` has gone. The
 * second request names what was wrong with the first: the refused wording,
 * and that it called the animal he or she. Each of the title and the
 * introduction is then taken from whichever draft has a printable one; a
 * field refused in both comes back empty and the chapter keeps what it
 * already had. A title that only repeats another chapter's is never emptied.
 */
/** The retry must be back by this long after the first call began. */
const RETRY_DEADLINE_MS = 50_000;

export async function generateCheckedStory(
  provider: Pick<StoryProvider, "generateStory">,
  chapter: StoryRequest,
  signal?: AbortSignal,
  options?: GenerateOptions,
  guard: GuardOptions = {},
): Promise<StoryDraft> {
  const now = guard.now ?? Date.now;
  const budget = guard.retryBudgetMs ?? RETRY_BUDGET_MS;
  const startedAt = now();

  const first = checkDraft(await provider.generateStory(chapter, signal, options), chapter);
  if (problems(first) === 0 || signal?.aborted) return usable(first);
  if (now() - startedAt > budget) return usable(first);

  const rejected = [
    first.titleMatch || first.titleRepeat ? first.draft.title : null,
    first.blurbMatch ? first.draft.blurb : null,
    first.titleMatch,
    first.titleRepeat,
    first.blurbMatch,
  ].filter((line): line is string => Boolean(line));

  // The retry gets what is left of the route's minute and no more. Without a
  // deadline a stalled second call ran the route out of time and the customer
  // got an error for a chapter whose first draft was usable.
  const remaining = Math.max(1_000, RETRY_DEADLINE_MS - (now() - startedAt));
  const deadline = AbortSignal.timeout(remaining);
  const retrySignal = signal ? AbortSignal.any([signal, deadline]) : deadline;

  let second: DraftCheck;
  try {
    second = checkDraft(
      await provider.generateStory(chapter, retrySignal, {
        ...options,
        rejected: [...new Set(rejected)],
        guessedSex: first.guessedSex,
        isRetry: true,
      }),
      chapter,
    );
  } catch {
    // The retry is a courtesy; a chapter that was written once is not failed
    // because writing it twice did not work.
    return usable(first);
  }

  // The retry wins a tie: it was written knowing what was refused, and a
  // title that is still another chapter's is kept in its second form.
  const [base, other] = problems(second) <= problems(first) ? [second, first] : [first, second];
  const kept = usable(base);
  return {
    ...kept,
    title: titleLost(base) && !titleLost(other) ? other.draft.title : kept.title,
    blurb: blurbLost(base) && !blurbLost(other) ? other.draft.blurb : kept.blurb,
  };
}

function titleLost(check: DraftCheck): boolean {
  return Boolean(check.titleMatch) || check.titleGuess;
}

function blurbLost(check: DraftCheck): boolean {
  return Boolean(check.blurbMatch) || check.blurbGuess;
}

/** A field that will be emptied weighs more than a title the book has twice. */
function problems(check: DraftCheck): number {
  return (
    (titleLost(check) ? 2 : check.titleRepeat ? 1 : 0) + (blurbLost(check) ? 2 : 0)
  );
}

/**
 * The draft with whatever is still refused blanked out: a copied example or
 * a guessed "he"/"she" never prints, in a first draft or a second.
 */
function usable(check: DraftCheck): StoryDraft {
  return {
    ...check.draft,
    title: titleLost(check) ? "" : check.draft.title,
    blurb: blurbLost(check) ? "" : check.draft.blurb,
  };
}
