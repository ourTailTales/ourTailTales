import { GoogleGenAI, Type, type Part, type Schema } from "@google/genai";

import { PROFILE_SYSTEM_PROMPT, buildProfilePrompt } from "@/lib/ai/profile-prompt";
import { buildStoryPrompt, soundsLikeACaption, storySystemPrompt } from "@/lib/ai/prompt";
import { parsePetProfile, parseStoryDraft, type StoryProvider } from "@/lib/ai/provider";
import { readEnv, requireEnv } from "@/lib/env";

const PROVIDER_ID = "gemini";
/**
 * A full Flash model rather than Flash-Lite. Lite wrote serviceable captions
 * and flat prose; the chapter copy is the part of the book people read aloud,
 * and the difference costs a few cents a book. `AI_MODEL` overrides it.
 */
const DEFAULT_MODEL = "gemini-flash-latest";

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
        "A warm, specific 35 to 60 word introduction (two or three sentences) about the pet, built on details visible in the attached pictures. Never about the photographs themselves.",
    },
  },
  required: ["title", "dateLabel", "blurb"],
  propertyOrdering: ["title", "dateLabel", "blurb"],
};

const HEX_DESCRIPTION = "Hex color like #a33b2f.";

const PALETTE_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    name: { type: Type.STRING, description: "2 to 5 evocative words." },
    reason: {
      type: Type.STRING,
      description: "One sentence naming what on the pet it echoes.",
    },
    paper: { type: Type.STRING, description: `Very light page color. ${HEX_DESCRIPTION}` },
    ink: { type: Type.STRING, description: `Very dark body-text color. ${HEX_DESCRIPTION}` },
    accent: { type: Type.STRING, description: `Rich, readable heading color. ${HEX_DESCRIPTION}` },
    tape: {
      type: Type.ARRAY,
      items: { type: Type.STRING, description: HEX_DESCRIPTION },
      description: "Four washi-tape colors.",
    },
    scraps: {
      type: Type.ARRAY,
      items: { type: Type.STRING, description: HEX_DESCRIPTION },
      description: "Three pale paper-scrap colors.",
    },
    doodle: { type: Type.STRING, description: `Doodle line color. ${HEX_DESCRIPTION}` },
  },
  required: ["name", "reason", "paper", "ink", "accent", "tape", "scraps", "doodle"],
  propertyOrdering: ["name", "reason", "paper", "ink", "accent", "tape", "scraps", "doodle"],
};

const PROFILE_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    appearance: { type: Type.STRING, description: "One sentence, at most 25 words." },
    accessories: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          item: { type: Type.STRING },
          color: { type: Type.STRING },
        },
        required: ["item", "color"],
      },
    },
    motifs: { type: Type.ARRAY, items: { type: Type.STRING } },
    palettes: { type: Type.ARRAY, items: PALETTE_SCHEMA, description: "Exactly three." },
  },
  required: ["appearance", "accessories", "motifs", "palettes"],
  propertyOrdering: ["appearance", "accessories", "motifs", "palettes"],
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
      const write = async (): Promise<ReturnType<typeof parseStoryDraft>> => {
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
            // The writing rules travel with every request — not AI Studio state.
            systemInstruction: storySystemPrompt({ stillHere: chapter.stillHere }),
            responseMimeType: "application/json",
            responseSchema: RESPONSE_SCHEMA,
            // Higher than a factual task wants: the same album should not
            // produce the same three sentence shapes chapter after chapter.
            temperature: 0.9,
            maxOutputTokens: 4000,
            // Tools are intentionally unset, which keeps this call free of
            // Google Search, Maps, code execution, and URL context.
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
      };

      const draft = await write();
      // One more try if it still writes a caption about the photographs; if
      // the second is no better, the first is kept rather than failing.
      if (!soundsLikeACaption(draft.blurb) || signal?.aborted) return draft;
      const second = await write().catch(() => draft);
      return soundsLikeACaption(second.blurb) ? draft : second;
    },

    async generateProfile(request, signal) {
      const response = await client.models.generateContent({
        model,
        contents: [
          {
            role: "user",
            parts: [
              { text: buildProfilePrompt(request) },
              ...imageParts(request.thumbnails),
            ],
          },
        ],
        config: {
          systemInstruction: PROFILE_SYSTEM_PROMPT,
          responseMimeType: "application/json",
          responseSchema: PROFILE_SCHEMA,
          temperature: 0.6,
          maxOutputTokens: 4000,
          abortSignal: signal,
        },
      });

      const text = response.text;
      if (!text) throw new Error("Gemini returned no profile.");
      return parsePetProfile(text, PROVIDER_ID);
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
