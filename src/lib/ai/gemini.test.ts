import { beforeEach, describe, expect, it, vi } from "vitest";

const generateContent = vi.fn();

vi.mock("@google/genai", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@google/genai")>();
  return {
    ...actual,
    GoogleGenAI: class {
      models = { generateContent };
    },
  };
});

import { MediaResolution, ThinkingLevel } from "@google/genai";

import { createGeminiProvider } from "@/lib/ai/gemini";
import type { StoryRequest } from "@/types/story";

const chapter: StoryRequest = {
  petName: "Rocket",
  lifespan: "",
  dateLabel: "Spring 2016",
  photoCount: 10,
  selectedCount: 8,
  places: [],
  seasons: [],
  thumbnails: ["data:image/jpeg;base64,AAAA"],
  chapterNumber: 1,
  chapterCount: 5,
};

const story = JSON.stringify({
  title: "The Lawn Was His",
  dateLabel: "Spring 2016",
  blurb: "Spring meant one thing: the lawn.",
});

function reply(text: string) {
  return {
    text,
    usageMetadata: { promptTokenCount: 1200, candidatesTokenCount: 90, thoughtsTokenCount: 0 },
  };
}

describe("the Gemini provider's cost settings", () => {
  beforeEach(() => {
    generateContent.mockReset();
    process.env.GEMINI_API_KEY = "test";
    delete process.env.AI_MODEL;
  });

  it("uses Flash-Lite with minimal thinking and low media resolution", async () => {
    generateContent.mockResolvedValue(reply(story));
    const usage = vi.fn();
    const provider = createGeminiProvider();
    await provider.generateStory(chapter, undefined, { onUsage: usage });

    const request = generateContent.mock.calls[0]![0];
    expect(request.model).toBe("gemini-flash-lite-latest");
    expect(request.config.thinkingConfig).toEqual({ thinkingLevel: ThinkingLevel.MINIMAL });
    expect(request.config.mediaResolution).toBe(MediaResolution.MEDIA_RESOLUTION_LOW);
    expect(request.config.maxOutputTokens).toBeLessThanOrEqual(800);
    expect(usage).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "chapter", inputTokens: 1200, outputTokens: 90, images: 1 }),
    );
  });

  it("asks again without the thinking setting when a model rejects it", async () => {
    generateContent
      .mockRejectedValueOnce(new Error("400 INVALID_ARGUMENT: thinking level is not supported"))
      .mockResolvedValueOnce(reply(story));
    const provider = createGeminiProvider();
    const draft = await provider.generateStory(chapter);

    expect(draft.title).toBe("The Lawn Was His");
    expect(generateContent).toHaveBeenCalledTimes(2);
    expect(generateContent.mock.calls[1]![0].config.thinkingConfig).toBeUndefined();
  });

  it("does not hide other failures behind the retry", async () => {
    generateContent.mockRejectedValue(new Error("503 overloaded"));
    await expect(createGeminiProvider().generateStory(chapter)).rejects.toThrow("503");
    expect(generateContent).toHaveBeenCalledTimes(1);
  });
});
