import { describe, expect, it, vi } from "vitest";

import {
  EXAMPLE_CAPTIONS,
  EXAMPLE_GOOD_OPENINGS,
  EXAMPLE_TITLES,
  PROMPT_EXAMPLE_LINES,
} from "@/lib/ai/examples";
import {
  RETRY_BUDGET_MS,
  checkDraft,
  generateCheckedStory,
  matchedExample,
  matchedExampleInOpening,
  matchesExample,
  normalizeLine,
  sameLine,
  supportedDateLabel,
} from "@/lib/story/guard";
import * as lines from "@/lib/story/lines";
import { withoutUsedCaptions } from "@/lib/story/lines";
import type { StoryDraft, StoryRequest } from "@/types/story";

const chapter: StoryRequest = {
  petName: "Biscuit",
  lifespan: "",
  dateLabel: "Spring 2019",
  photoCount: 10,
  selectedCount: 8,
  places: [],
  seasons: ["spring"],
  thumbnails: [],
};

function draftOf(overrides: Partial<StoryDraft> = {}, captions: string[] = []): StoryDraft {
  return {
    title: "Mud Up To The Elbows",
    dateLabel: "Spring 2019",
    blurb: "March was mostly rain. Biscuit took that as an invitation and spent it outdoors anyway.",
    ...(captions.length > 0
      ? { pages: captions.map((caption, index) => ({ photos: [index + 1], caption })) }
      : {}),
    ...overrides,
  };
}

describe("normalizeLine", () => {
  it("ignores case, punctuation and accents", () => {
    expect(normalizeLine("  Nose first — as USUAL!  ")).toBe("nose first as usual");
    expect(normalizeLine("Somebody’s café")).toBe("somebodys cafe");
  });
});

describe("a line taken from the prompts' own examples", () => {
  it("is caught word for word, whatever the case and punctuation", () => {
    for (const example of PROMPT_EXAMPLE_LINES) {
      const shouted = example.toUpperCase().replace(/[,.]/g, "");
      expect(matchedExample(shouted) ?? matchedExampleInOpening(shouted)).not.toBeNull();
    }
  });

  it("is caught with a word or a name changed, in a line long enough to tell", () => {
    expect(matchedExample("Back at the lake by July")).toBe(EXAMPLE_CAPTIONS.lakeFlat);
    expect(matchedExample("Back at the lake in June")).toBe(EXAMPLE_CAPTIONS.lakeFlat);
    expect(matchedExample("The first warm week of July")).toBe(EXAMPLE_CAPTIONS.warmWeek);
    expect(matchedExample("Out into the sunny green garden")).toBe(EXAMPLE_CAPTIONS.guessedYard);
    expect(
      matchedExampleInOpening(
        "August in Denver was the kind of heat nobody argues with. Biscuit slept through it.",
      ),
    ).not.toBeNull();
    expect(
      matchedExampleInOpening(
        "Everything was new and most of it was far too tall. Biscuit got on with it.",
      ),
    ).not.toBeNull();
  });

  it("is caught sitting whole inside a longer line", () => {
    expect(matchedExample("Nose first, as usual, into the hedge")).toBe(
      EXAMPLE_CAPTIONS.noseFirst,
    );
    expect(matchedExample("Right by the fireplace this year")).toBe(EXAMPLE_CAPTIONS.fireplace);
    expect(matchedExample("Small Dog, Big House, Again")).toBe(EXAMPLE_TITLES.bigHouse);
    expect(
      matchedExampleInOpening(
        `Biscuit had a good spring. ${EXAMPLE_GOOD_OPENINGS.tooHot.split(". ")[1]}`,
      ),
    ).not.toBeNull();
  });

  it("is caught when a caption is a whole sentence of a quoted introduction", () => {
    expect(matchedExample("Everything was new and most of it was too tall")).not.toBeNull();
    expect(matchedExample("August in Farmington was the kind of heat nobody argues with!")).not.toBeNull();
  });

  it("leaves a line of the book's own alone", () => {
    for (const line of [
      "The long way round, twice",
      "June",
      "Three weeks of rain",
      "Home",
      "The house in the first week",
    ]) {
      expect(matchedExample(line)).toBeNull();
    }
    expect(matchedExampleInOpening(draftOf().blurb)).toBeNull();
  });

  it("does not take a short honest phrase for a reworded example", () => {
    // Four words, three of them shared with "Right by the fireplace".
    expect(matchedExample("Right by the door")).toBeNull();
    expect(matchesExample("Right by the door", EXAMPLE_CAPTIONS.fireplace)).toBe(false);
    expect(matchedExample("Right by the back door")).toBeNull();
    expect(matchedExample("Nose first, as ever")).toBeNull();
    expect(matchedExample("Too Cold To Bother")).toBeNull();
  });

  it("does not refuse a few words for turning up inside a longer example", () => {
    // Inside "Back at the lake by June", and none the worse for it.
    expect(matchedExample("Back at the lake")).toBeNull();
    expect(matchesExample("Back at the lake", EXAMPLE_CAPTIONS.lakeFlat)).toBe(false);
    expect(matchedExample("The first warm week")).toBeNull();
    // The other way round is still a copy.
    expect(matchesExample("Back at the lake by June, again", EXAMPLE_CAPTIONS.lakeFlat)).toBe(true);
  });

  it("only finds a contained example when the example has four words or more", () => {
    expect(matchesExample("Too hot to bother with", "Too Hot To Bother")).toBe(true);
    expect(matchesExample("Right by the lake", "Right by")).toBe(false);
    expect(matchesExample("Right by", "right by.")).toBe(true);
  });

  it("only calls it a rewording at six words and eight in ten shared", () => {
    // Five of six.
    expect(matchesExample("one two three four five six", "one two three four five nine")).toBe(true);
    // Four of five: too short to tell.
    expect(matchesExample("one two three four five", "one two three four nine")).toBe(false);
    // Seven of ten.
    expect(
      matchesExample("a b c d e f g x y z", "a b c d e f g h i j"),
    ).toBe(false);
  });
});

describe("an introduction and the examples that are not introductions", () => {
  it("is not refused for containing a quoted title or caption", () => {
    for (const blurb of [
      "It was too hot to bother with the yard. Biscuit stayed in until the evenings came back.",
      "Winter came early. Biscuit spent it right by the fireplace this year, and nobody argued.",
      "Nose first, as usual, and straight into the hedge. That was most of April.",
      "They were back at the lake by June and stayed until the weather turned.",
    ]) {
      expect(matchedExampleInOpening(blurb), blurb).toBeNull();
      expect(checkDraft(draftOf({ blurb }), chapter).blurbMatch).toBeNull();
    }
  });

  it("is still refused for a sentence of a quoted introduction, whole or reworded", () => {
    expect(matchedExampleInOpening(EXAMPLE_GOOD_OPENINGS.bigHouse)).not.toBeNull();
    expect(
      matchedExampleInOpening(
        "A long spring. Biscuit found the coolest room in the house early on and made the rest of the summer somebody else's problem.",
      ),
    ).not.toBeNull();
  });
});

describe("sameLine, for two lines of one book", () => {
  it("is the same line whatever the case and punctuation", () => {
    expect(sameLine("Three weeks of rain, all of it", "three weeks of rain all of it.")).toBe(true);
    expect(sameLine("Somebody’s café", "somebodys cafe")).toBe(true);
    expect(sameLine("", "")).toBe(false);
  });

  it.each([
    ["Summer at the lake", "Winter at the lake"],
    ["First swim of the year", "First snow of the year"],
    ["A quiet week in March", "A quiet week in April"],
    ["Two days at the coast", "Three days at the coast"],
    ["Back at the lake in June", "Back at the lake"],
    ["The slow middle of winter", "The long slow middle of winter"],
    ["Home by June", "Gone by June"],
  ])("lets an honest calendar pair through: %s / %s", (earlier, later) => {
    expect(sameLine(earlier, later)).toBe(false);

    // Within one response. (The one line here that is itself a rewording of
    // a prompt example is refused for that, and has its own test below.)
    if (matchedExample(earlier) === null) {
      const within = checkDraft(draftOf({}, [earlier, later]), chapter);
      expect(within.draft.pages?.map((page) => page.caption)).toEqual([earlier, later]);
    }

    // Against an earlier chapter's captions, and its titles.
    const across = checkDraft(draftOf({ title: later }, [later]), {
      alreadyUsed: { titles: [earlier], captions: [earlier] },
    });
    expect(across.draft.pages?.[0]?.caption).toBe(later);
    expect(across.titleRepeat).toBeNull();
    expect(across.droppedCaptions).toBe(0);
  });

  it("refuses 'Back at the lake in June' as an example reworded, never as a repeat", () => {
    // Six words, five of them "Back at the lake by June" in order: an example
    // copy whatever the rest of the book says. The shorter line is the book's.
    expect(matchedExample("Back at the lake in June")).toBe(EXAMPLE_CAPTIONS.lakeFlat);
    const { draft } = checkDraft(draftOf({}, ["Back at the lake in June", "Back at the lake"]), {
      alreadyUsed: { titles: [], captions: ["Back at the lake again"] },
    });
    expect(draft.pages?.map((page) => page.caption)).toEqual([undefined, "Back at the lake"]);
  });

  it("comes from a file with no imports, so the browser can use it", async () => {
    const { readFileSync } = await import("node:fs");
    const source = readFileSync(new URL("./lines.ts", import.meta.url), "utf8");
    expect(source).not.toMatch(/^\s*import\s/m);
    expect(lines.sameLine).toBe(sameLine);
    expect(lines.normalizeLine).toBe(normalizeLine);
  });
});

describe("withoutUsedCaptions", () => {
  const story = draftOf({ title: "Mud Season" }, ["Three weeks of rain", "Mud season", "Home"]);

  it("drops the captions a chapter that finished meanwhile already has", () => {
    const result = withoutUsedCaptions(story, ["three weeks of rain.", "HOME!"]);
    expect(result.pages).toEqual([
      { photos: [1] },
      { photos: [2], caption: "Mud season" },
      { photos: [3] },
    ]);
  });

  it("goes by exact equality, and never touches the title", () => {
    const result = withoutUsedCaptions(story, ["Four weeks of rain", "Mud Season, again"]);
    expect(result).toBe(story);
    expect(withoutUsedCaptions(story, ["Mud season"]).title).toBe("Mud Season");
  });

  it("leaves a story without pages, or a book without lines, as it was", () => {
    expect(withoutUsedCaptions(draftOf(), ["Home"])).toEqual(draftOf());
    expect(withoutUsedCaptions(story, [])).toBe(story);
    expect(withoutUsedCaptions(story, ["", "  "])).toBe(story);
  });
});

describe("the date label", () => {
  it("is kept when every year in it is one of the chapter's own", () => {
    expect(supportedDateLabel("Spring 2019", { dateLabel: "Mar – May 2019" })).toBe("Spring 2019");
    expect(
      supportedDateLabel("Winter 2019–2020", {
        dateLabel: "",
        photos: [
          { i: 1, on: "2019-12-28", orientation: "portrait" },
          { i: 2, on: "2020-01-03", orientation: "portrait" },
          { i: 3, orientation: "square" },
        ],
      }),
    ).toBe("Winter 2019–2020");
    // No year named: nothing to be wrong about.
    expect(supportedDateLabel("Early spring", { dateLabel: "2019" })).toBe("Early spring");
  });

  it("comes back empty when it names a year the chapter is not from", () => {
    expect(supportedDateLabel("Spring 2016", { dateLabel: "Spring 2019" })).toBe("");
    expect(supportedDateLabel("2019–2021", { dateLabel: "2019–2020" })).toBe("");
    expect(supportedDateLabel("Spring 2016", {})).toBe("");
  });

  it("is checked on every draft, so the store keeps the chapter's own label", () => {
    expect(checkDraft(draftOf({ dateLabel: "Spring 2016" }), chapter).draft.dateLabel).toBe("");
    expect(checkDraft(draftOf(), chapter).draft.dateLabel).toBe("Spring 2019");
  });
});

describe("checkDraft", () => {
  it("drops a caption copied from the examples and keeps its page", () => {
    const { draft, droppedCaptions } = checkDraft(
      draftOf({}, [EXAMPLE_CAPTIONS.lakeFlat, "Three weeks of rain"]),
      chapter,
    );
    // No caption: the page prints the month its photographs were taken.
    expect(draft.pages?.[0]).toEqual({ photos: [1] });
    expect(draft.pages?.[1]?.caption).toBe("Three weeks of rain");
    expect(droppedCaptions).toBe(1);
  });

  it("keeps the first of a caption repeated within one response", () => {
    const { draft, droppedCaptions } = checkDraft(
      draftOf({}, [
        "Three weeks of rain",
        "The long way round, twice",
        "three weeks of rain.",
        "Three weeks of rain",
        "Three whole weeks of rain",
      ]),
      chapter,
    );
    // Identical lines only: the last is a different line, and stays.
    expect(draft.pages?.map((page) => page.caption)).toEqual([
      "Three weeks of rain",
      "The long way round, twice",
      undefined,
      undefined,
      "Three whole weeks of rain",
    ]);
    expect(draft.pages?.every((page) => page.photos.length === 1)).toBe(true);
    expect(droppedCaptions).toBe(2);
  });

  it("drops a caption an earlier chapter already used", () => {
    const { draft } = checkDraft(draftOf({}, ["Three weeks of rain!", "Mud season"]), {
      alreadyUsed: { titles: [], captions: ["three weeks of rain"] },
    });
    expect(draft.pages?.map((page) => page.caption)).toEqual([undefined, "Mud season"]);
  });

  it("treats an empty caption as no caption", () => {
    const { draft, droppedCaptions } = checkDraft(draftOf({}, ["", "  "]), chapter);
    expect(draft.pages).toEqual([{ photos: [1] }, { photos: [2] }]);
    expect(droppedCaptions).toBe(0);
  });

  it("drops a caption that guesses he or she, unless the owner said", () => {
    const captions = ["Entirely pleased with himself", "Mud season"];
    expect(
      checkDraft(draftOf({}, captions), chapter).draft.pages?.map((page) => page.caption),
    ).toEqual([undefined, "Mud season"]);
    expect(
      checkDraft(draftOf({}, captions), { notes: "He hates the vacuum." }).draft.pages?.map(
        (page) => page.caption,
      ),
    ).toEqual(captions);
  });

  it("flags a title from the examples, and separately one from an earlier chapter", () => {
    const copied = checkDraft(draftOf({ title: "too hot to bother" }), chapter);
    expect(copied.titleMatch).toBe(EXAMPLE_TITLES.tooHot);
    expect(copied.titleRepeat).toBeNull();

    const repeated = checkDraft(draftOf(), {
      alreadyUsed: { titles: ["Mud up to the elbows"], captions: [] },
    });
    expect(repeated.titleRepeat).toBe("Mud up to the elbows");
    expect(repeated.titleMatch).toBeNull();

    const own = checkDraft(draftOf(), chapter);
    expect(own.titleMatch).toBeNull();
    expect(own.titleRepeat).toBeNull();
  });

  it("says which of the title and the introduction guessed he or she", () => {
    const title = checkDraft(draftOf({ title: "Her Side Of The Bed" }), chapter);
    expect([title.titleGuess, title.blurbGuess, title.guessedSex]).toEqual([true, false, true]);
    const blurb = checkDraft(draftOf({ blurb: "March was rain. He went out anyway." }), chapter);
    expect([blurb.titleGuess, blurb.blurbGuess, blurb.guessedSex]).toEqual([false, true, true]);
    const told = checkDraft(draftOf({ title: "Her Side Of The Bed" }), {
      notes: "The best girl.",
    });
    expect(told.guessedSex).toBe(false);
  });
});

describe("generateCheckedStory", () => {
  const copied = draftOf({
    title: EXAMPLE_TITLES.tooHot,
    blurb: EXAMPLE_GOOD_OPENINGS.tooHot,
  });

  it("returns a clean draft without asking twice", async () => {
    const generateStory = vi.fn().mockResolvedValue(draftOf());
    const draft = await generateCheckedStory({ generateStory }, chapter);
    expect(draft).toEqual(draftOf());
    expect(generateStory).toHaveBeenCalledTimes(1);
  });

  it("asks once more when the title or introduction is an example, naming what was refused", async () => {
    const generateStory = vi.fn().mockResolvedValueOnce(copied).mockResolvedValueOnce(draftOf());
    const draft = await generateCheckedStory({ generateStory }, chapter);

    expect(draft.title).toBe("Mud Up To The Elbows");
    expect(generateStory).toHaveBeenCalledTimes(2);
    const retry = generateStory.mock.calls[1]![2];
    expect(retry.isRetry).toBe(true);
    expect(retry.rejected).toContain(EXAMPLE_TITLES.tooHot);
    expect(retry.rejected).toContain(EXAMPLE_GOOD_OPENINGS.tooHot);
  });

  it("blanks what is still copied after the second attempt, and never asks a third time", async () => {
    const generateStory = vi.fn().mockResolvedValue(copied);
    const draft = await generateCheckedStory({ generateStory }, chapter);

    // Empty fields leave the chapter with the title and introduction it had.
    expect(draft.title).toBe("");
    expect(draft.blurb).toBe("");
    expect(draft.dateLabel).toBe("Spring 2019");
    expect(generateStory).toHaveBeenCalledTimes(2);
  });

  it("keeps the good half of a draft whose other half was copied twice", async () => {
    const generateStory = vi.fn().mockResolvedValue(draftOf({ title: EXAMPLE_TITLES.bigHouse }));
    const draft = await generateCheckedStory({ generateStory }, chapter);
    expect(draft.title).toBe("");
    expect(draft.blurb).toBe(draftOf().blurb);
  });

  it("does not fail a chapter because the second attempt failed", async () => {
    const generateStory = vi
      .fn()
      .mockResolvedValueOnce(draftOf({ title: EXAMPLE_TITLES.tooHot }))
      .mockRejectedValueOnce(new Error("503 overloaded"));
    const draft = await generateCheckedStory({ generateStory }, chapter);
    expect(draft.title).toBe("");
    expect(draft.blurb).toBe(draftOf().blurb);
  });

  describe("a title another chapter already has", () => {
    const later: StoryRequest = {
      ...chapter,
      alreadyUsed: { titles: ["Mud up to the elbows", "The Long Way Round"], captions: [] },
    };

    it("is asked for once more, with the refused title named", async () => {
      const generateStory = vi
        .fn()
        .mockResolvedValueOnce(draftOf())
        .mockResolvedValueOnce(draftOf({ title: "Rain, Mostly" }));
      const draft = await generateCheckedStory({ generateStory }, later);
      expect(draft.title).toBe("Rain, Mostly");
      expect(generateStory).toHaveBeenCalledTimes(2);
      expect(generateStory.mock.calls[1]![2].rejected).toContain("Mud Up To The Elbows");
    });

    it("keeps the second title even when that is a repeat too — never the chapter default", async () => {
      const generateStory = vi
        .fn()
        .mockResolvedValueOnce(draftOf())
        .mockResolvedValueOnce(draftOf({ title: "The long way round" }));
      const draft = await generateCheckedStory({ generateStory }, later);
      expect(draft.title).toBe("The long way round");
      expect(generateStory).toHaveBeenCalledTimes(2);
    });

    it("keeps the repeated title when the second attempt fails or copies an example", async () => {
      const failed = vi
        .fn()
        .mockResolvedValueOnce(draftOf())
        .mockRejectedValueOnce(new Error("503 overloaded"));
      expect((await generateCheckedStory({ generateStory: failed }, later)).title).toBe(
        "Mud Up To The Elbows",
      );

      const copiedSecond = vi
        .fn()
        .mockResolvedValueOnce(draftOf())
        .mockResolvedValueOnce(draftOf({ title: EXAMPLE_TITLES.tooHot }));
      expect((await generateCheckedStory({ generateStory: copiedSecond }, later)).title).toBe(
        "Mud Up To The Elbows",
      );
    });

    it("does not ask again for a title that only resembles an earlier one", async () => {
      const generateStory = vi.fn().mockResolvedValue(draftOf({ title: "Mud Up To The Knees" }));
      const draft = await generateCheckedStory({ generateStory }, later);
      expect(draft.title).toBe("Mud Up To The Knees");
      expect(generateStory).toHaveBeenCalledTimes(1);
    });
  });

  describe("a guessed he or she", () => {
    const guessed = draftOf({ blurb: "March was mostly rain. He spent it outdoors anyway." });

    it("tells the second attempt what was wrong with the first", async () => {
      const generateStory = vi.fn().mockResolvedValueOnce(guessed).mockResolvedValueOnce(draftOf());
      const draft = await generateCheckedStory({ generateStory }, chapter);
      expect(draft.blurb).toBe(draftOf().blurb);
      expect(generateStory).toHaveBeenCalledTimes(2);
      expect(generateStory.mock.calls[0]![2]?.guessedSex).toBeUndefined();
      const retry = generateStory.mock.calls[1]![2];
      expect(retry.guessedSex).toBe(true);
      expect(retry.isRetry).toBe(true);
      expect(retry.rejected).toEqual([]);
    });

    it("blanks an introduction that still guesses, so the guess never prints", async () => {
      const generateStory = vi.fn().mockResolvedValue(guessed);
      const draft = await generateCheckedStory({ generateStory }, chapter);
      expect(generateStory).toHaveBeenCalledTimes(2);
      expect(draft.blurb).toBe("");
      expect(draft.title).toBe("Mud Up To The Elbows");
    });

    it("blanks a title that still guesses, and keeps the introduction", async () => {
      const generateStory = vi.fn().mockResolvedValue(draftOf({ title: "His Kind Of Weather" }));
      const draft = await generateCheckedStory({ generateStory }, chapter);
      expect(draft.title).toBe("");
      expect(draft.blurb).toBe(draftOf().blurb);
    });

    it("does not print the guess when the second attempt fails", async () => {
      const generateStory = vi
        .fn()
        .mockResolvedValueOnce(guessed)
        .mockRejectedValueOnce(new Error("503 overloaded"));
      expect((await generateCheckedStory({ generateStory }, chapter)).blurb).toBe("");
    });

    it("is not a guess when the owner said", async () => {
      const generateStory = vi.fn().mockResolvedValue(guessed);
      const draft = await generateCheckedStory(
        { generateStory },
        { ...chapter, notes: "Such a good boy." },
      );
      expect(draft.blurb).toBe(guessed.blurb);
      expect(generateStory).toHaveBeenCalledTimes(1);
    });
  });

  it("takes each of the title and the introduction from whichever draft has a printable one", async () => {
    const generateStory = vi
      .fn()
      .mockResolvedValueOnce(draftOf({ title: EXAMPLE_TITLES.tooHot }))
      .mockResolvedValueOnce(
        draftOf({ title: "Rain, Mostly", blurb: EXAMPLE_GOOD_OPENINGS.bigHouse }),
      );
    const draft = await generateCheckedStory({ generateStory }, chapter);
    expect(draft.title).toBe("Rain, Mostly");
    expect(draft.blurb).toBe(draftOf().blurb);
  });

  describe("the time budget", () => {
    /** A clock that reads `first` at the start and `then` once a draft is back. */
    const clock = (elapsed: number) => {
      const readings = [1_000, 1_000 + elapsed];
      return () => readings.shift() ?? 1_000 + elapsed;
    };

    it("skips the second attempt once 25 seconds have gone, and returns the first draft's usable form", async () => {
      const generateStory = vi.fn().mockResolvedValue(copied);
      const draft = await generateCheckedStory({ generateStory }, chapter, undefined, undefined, {
        now: clock(RETRY_BUDGET_MS + 1),
      });
      expect(generateStory).toHaveBeenCalledTimes(1);
      expect(draft.title).toBe("");
      expect(draft.blurb).toBe("");
      expect(draft.dateLabel).toBe("Spring 2019");
    });

    it("keeps a repeated title rather than blank it when there is no time to ask again", async () => {
      const generateStory = vi.fn().mockResolvedValue(draftOf());
      const draft = await generateCheckedStory(
        { generateStory },
        { ...chapter, alreadyUsed: { titles: ["Mud up to the elbows"], captions: [] } },
        undefined,
        undefined,
        { now: clock(40_000) },
      );
      expect(generateStory).toHaveBeenCalledTimes(1);
      expect(draft.title).toBe("Mud Up To The Elbows");
    });

    it("still asks again at exactly the budget and under it", async () => {
      expect(RETRY_BUDGET_MS).toBe(25_000);
      for (const elapsed of [0, 24_999, RETRY_BUDGET_MS]) {
        const generateStory = vi.fn().mockResolvedValueOnce(copied).mockResolvedValueOnce(draftOf());
        const draft = await generateCheckedStory({ generateStory }, chapter, undefined, undefined, {
          now: clock(elapsed),
        });
        expect(generateStory).toHaveBeenCalledTimes(2);
        expect(draft.title).toBe("Mud Up To The Elbows");
      }
    });

    it("takes the budget from the caller when given one", async () => {
      const generateStory = vi.fn().mockResolvedValue(copied);
      await generateCheckedStory({ generateStory }, chapter, undefined, undefined, {
        now: clock(5_000),
        retryBudgetMs: 4_000,
      });
      expect(generateStory).toHaveBeenCalledTimes(1);
    });
  });

  it("still fails when the first attempt fails", async () => {
    const generateStory = vi.fn().mockRejectedValue(new Error("503 overloaded"));
    await expect(generateCheckedStory({ generateStory }, chapter)).rejects.toThrow("503");
  });
});
