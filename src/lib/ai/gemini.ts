import {
  GoogleGenAI,
  MediaResolution,
  ThinkingLevel,
  Type,
  type Part,
  type Schema,
} from "@google/genai";

import { PROFILE_SYSTEM_PROMPT, buildProfilePrompt } from "@/lib/ai/profile-prompt";
import { buildStoryPrompt, soundsLikeACaption, storySystemPrompt } from "@/lib/ai/prompt";
import {
  parsePetProfile,
  parseStoryDraft,
  type AiUsage,
  type StoryProvider,
} from "@/lib/ai/provider";
import { readEnv, requireEnv } from "@/lib/env";

const PROVIDER_ID = "gemini";
/**
 * The cheapest model that writes well enough, with thinking turned down and
 * images read at low resolution (see `generate` below). The flat copy Lite
 * used to produce came from the prompt, not the model. Set `AI_MODEL` to a
 * Flash model to trade cost for polish; it keeps the same cost settings.
 */
const DEFAULT_MODEL = "gemini-flash-lite-latest";

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
        "A warm, cohesive 25 to 40 word introduction (two or three sentences): one small story about the pet built on at most two connected details visible in the pictures. Never a list, never about the photographs.",
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

  /**
   * One call, configured for cost. Two settings do most of the work:
   *
   * - Minimal thinking. A Flash model thinks by default and bills it as
   *   output — around 8k of the 9k output tokens a book used to cost, for
   *   copy that is 150 tokens long.
   * - Low media resolution. Gemini bills an image by this setting, not by
   *   its pixels: ~280 tokens at LOW against ~1,100 by default.
   *
   * A model that rejects the thinking setting is asked again without it
   * rather than failing the chapter.
   */
  const generate = async (args: {
    kind: AiUsage["kind"];
    prompt: string;
    thumbnails: string[];
    systemInstruction: string;
    responseSchema: Schema;
    temperature: number;
    maxOutputTokens: number;
    signal?: AbortSignal;
    onUsage?: (usage: AiUsage) => void;
  }): Promise<string> => {
    const images = imageParts(args.thumbnails);
    const request = (withThinking: boolean) =>
      client.models.generateContent({
        model,
        contents: [{ role: "user", parts: [{ text: args.prompt }, ...images] }],
        config: {
          // The rules travel with every request — not AI Studio state.
          systemInstruction: args.systemInstruction,
          responseMimeType: "application/json",
          responseSchema: args.responseSchema,
          temperature: args.temperature,
          maxOutputTokens: args.maxOutputTokens,
          mediaResolution: MediaResolution.MEDIA_RESOLUTION_LOW,
          ...(withThinking
            ? { thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL } }
            : {}),
          // Tools are intentionally unset, which keeps this call free of
          // Google Search, Maps, code execution, and URL context.
          abortSignal: args.signal,
        },
      });

    let response;
    try {
      response = await request(true);
    } catch (error) {
      if (!rejectedThinking(error) || args.signal?.aborted) throw error;
      response = await request(false);
    }

    const usage = response.usageMetadata;
    args.onUsage?.({
      kind: args.kind,
      model,
      inputTokens: usage?.promptTokenCount ?? 0,
      outputTokens: usage?.candidatesTokenCount ?? 0,
      thinkingTokens: usage?.thoughtsTokenCount ?? 0,
      images: images.length,
    });

    const text = response.text;
    if (!text) {
      throw new Error(`Gemini returned no ${args.kind} text. It may have declined this request.`);
    }
    return text;
  };

  return {
    id: PROVIDER_ID,
    model,

    async generateStory(chapter, signal, options) {
      const write = async (): Promise<ReturnType<typeof parseStoryDraft>> =>
        parseStoryDraft(
          await generate({
            kind: "chapter",
            prompt: buildStoryPrompt(chapter),
            thumbnails: chapter.thumbnails,
            systemInstruction: storySystemPrompt({ stillHere: chapter.stillHere }),
            responseSchema: RESPONSE_SCHEMA,
            // Higher than a factual task wants: the same album should not
            // produce the same sentence shapes chapter after chapter.
            temperature: 0.9,
            // Copy is ~150 tokens; the cap leaves room for a little thinking.
            maxOutputTokens: 800,
            signal,
            onUsage: options?.onUsage,
          }),
          PROVIDER_ID,
        );

      const draft = await write();
      // One more try if it still writes a caption about the photographs; if
      // the second is no better, the first is kept rather than failing.
      if (!soundsLikeACaption(draft.blurb) || signal?.aborted) return draft;
      const second = await write().catch(() => draft);
      return soundsLikeACaption(second.blurb) ? draft : second;
    },

    async generateProfile(request, signal, options) {
      return parsePetProfile(
        await generate({
          kind: "profile",
          prompt: buildProfilePrompt(request),
          thumbnails: request.thumbnails,
          systemInstruction: PROFILE_SYSTEM_PROMPT,
          responseSchema: PROFILE_SCHEMA,
          temperature: 0.6,
          maxOutputTokens: 1500,
          signal,
          onUsage: options?.onUsage,
        }),
        PROVIDER_ID,
      );
    },
  };
}

/** A 400 about the thinking config: this model does not take that setting. */
function rejectedThinking(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /thinking/i.test(message) && /400|invalid|not supported|unsupported/i.test(message);
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
