import { GoogleGenAI, Type, type Part, type Schema } from "@google/genai";

import { STORY_SYSTEM_PROMPT, buildStoryPrompt } from "@/lib/ai/prompt";
import { parseStoryDraft, type StoryProvider } from "@/lib/ai/provider";
import { readEnv, requireEnv } from "@/lib/env";

const PROVIDER_ID = "gemini";
const DEFAULT_MODEL = "gemini-3.1-flash-lite";

/** Only these arrive from the browser's thumbnail renderer. */
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
const DATA_URL = /^data:([a-z]+\/[a-z0-9.+-]+);base64,([A-Za-z0-9+/]+={0,2})$/;

/**
 * Gemini structured-output schema — declared in code, not in AI Studio.
 *
 * Exactly three fields. No tools, grounding, or playground-saved state is
 * involved; production behavior is whatever this file says.
 */
const RESPONSE_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    title: {
      type: Type.STRING,
      description: "A short, warm chapter title, ideally 2 to 6 words.",
    },
    dateLabel: {
      type: Type.STRING,
      description:
        "A concise human-readable date and optional general location label. Do not include exact addresses.",
    },
    blurb: {
      type: Type.STRING,
      description:
        "A warm 60 to 110 word memorial-book chapter introduction based only on the supplied images and metadata.",
    },
  },
  required: ["title", "dateLabel", "blurb"],
  propertyOrdering: ["title", "dateLabel", "blurb"],
};

/**
 * Chapter copy from Google Gemini via `@google/genai`.
 *
 * Every generation setting lives here so a Google AI Studio playground cannot
 * silently change production. `GEMINI_API_KEY` is server-only — never a
 * `NEXT_PUBLIC_` variable — and never reaches the browser.
 */
export function createGeminiProvider(): StoryProvider {
  // Server-side only. Do not rename to NEXT_PUBLIC_GEMINI_API_KEY.
  const [apiKey] = requireEnv("GEMINI_API_KEY");
  const model = readEnv("AI_MODEL") ?? DEFAULT_MODEL;
  const client = new GoogleGenAI({ apiKey });

  return {
    id: PROVIDER_ID,
    model,

    async generateStory(chapter, signal) {
      const response = await client.models.generateContent({
        model,
        contents: [
          {
            role: "user",
            parts: [
              { text: buildStoryPrompt(chapter) },
              ...imageParts(chapter.thumbnails),
            ],
          },
        ],
        config: {
          // Memorial-writing rules travel with every request — not AI Studio state.
          systemInstruction: STORY_SYSTEM_PROMPT,
          responseMimeType: "application/json",
          responseSchema: RESPONSE_SCHEMA,
          temperature: 0.7,
          maxOutputTokens: 2000,
          // Thinking and tools are intentionally unset. Flash-lite rejects
          // `thinkingBudget: 0`, and omitting both is the reproducible way to
          // keep this call free of thinking, Google Search, Maps, code
          // execution, and URL context.
          abortSignal: signal,
        },
      });

      const text = response.text;
      if (!text) {
        throw new Error(
          "Gemini returned no story text. It may have declined this chapter.",
        );
      }

      return parseStoryDraft(text, PROVIDER_ID);
    },
  };
}

/**
 * Converts the browser's data URLs into inline image parts.
 *
 * Anything that is not a recognised base64 image is dropped rather than
 * forwarded, so only picture bytes ever leave for the model.
 */
function imageParts(thumbnails: string[]): Part[] {
  return thumbnails.flatMap((thumbnail) => {
    const match = DATA_URL.exec(thumbnail.trim());
    if (!match) return [];

    const [, mimeType, data] = match;
    if (!ALLOWED_IMAGE_TYPES.includes(mimeType as never)) return [];

    return [{ inlineData: { mimeType, data } }];
  });
}
