import { GoogleGenAI, Type, type Part, type Schema } from "@google/genai";

import { STORY_SYSTEM_PROMPT, buildStoryPrompt } from "@/lib/ai/prompt";
import { parseStoryDraft, type StoryProvider } from "@/lib/ai/provider";
import { readEnv, requireEnv } from "@/lib/env";

const PROVIDER_ID = "gemini";
const DEFAULT_MODEL = "gemini-2.5-flash-lite";

/** Only these arrive from the browser's thumbnail renderer. */
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
const DATA_URL = /^data:([a-z]+\/[a-z0-9.+-]+);base64,([A-Za-z0-9+/]+={0,2})$/;

/**
 * Gemini's structured-output schema.
 *
 * `propertyOrdering` makes the model emit the title before the blurb, which
 * keeps the title from being a summary of prose it has already written.
 */
const RESPONSE_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    title: {
      type: Type.STRING,
      description: "Chapter title, at most 5 words, no quotation marks.",
    },
    dateLabel: {
      type: Type.STRING,
      description:
        "Short date label such as '2018' or 'Spring 2019', taken from the supplied chapter dates.",
    },
    blurb: {
      type: Type.STRING,
      description:
        "60 to 110 words introducing this chapter, inventing nothing.",
    },
    confidenceNotes: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description:
        "Two to four short notes naming the evidence behind the draft, and anything left vague for lack of it.",
    },
  },
  required: ["title", "dateLabel", "blurb", "confidenceNotes"],
  propertyOrdering: ["title", "dateLabel", "blurb", "confidenceNotes"],
};

/**
 * Chapter copy from Google Gemini.
 *
 * `GEMINI_API_KEY` is read here, on the server, and the SDK client is created
 * per request inside the route handler's process. It is never serialized into a
 * response and never reaches the browser.
 */
export function createGeminiProvider(): StoryProvider {
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
          systemInstruction: STORY_SYSTEM_PROMPT,
          responseMimeType: "application/json",
          responseSchema: RESPONSE_SCHEMA,
          // Warm but not florid; the rules matter more than the flourish.
          temperature: 0.6,
          maxOutputTokens: 900,
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
