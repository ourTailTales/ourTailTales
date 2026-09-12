import { z } from "zod";

import { readEnv } from "@/lib/env";
import type { StoryDraft, StoryRequest } from "@/types/story";

/**
 * The seam between ourTailTales and whichever model writes the chapters.
 *
 * Adding OpenAI later means writing one module that returns a `StoryProvider`
 * and registering it below. Nothing in the UI, the funnel, or the route handler
 * changes, because none of them know which provider is in use.
 */
export type StoryProvider = {
  /** Provider id, used in logs and in "not configured" messages. */
  readonly id: string;
  /** Resolved model name, so responses can be attributed. */
  readonly model: string;
  generateStory(
    chapter: StoryRequest,
    signal?: AbortSignal,
  ): Promise<StoryDraft>;
};

/** Providers must return this shape regardless of how their SDK spells it. */
export const storyDraftSchema = z.object({
  title: z.string().trim().min(1).max(120),
  dateLabel: z.string().trim().max(60).default(""),
  blurb: z.string().trim().min(1).max(1200),
  confidenceNotes: z.array(z.string().trim().min(1).max(300)).max(6).default([]),
});

/**
 * Validates a model's JSON before it reaches the book.
 *
 * Structured output makes the shape very likely but not guaranteed, and this
 * text gets printed, so it is checked rather than trusted.
 */
export function parseStoryDraft(raw: string, providerId: string): StoryDraft {
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    throw new Error(`The ${providerId} model did not return usable JSON.`);
  }

  const parsed = storyDraftSchema.safeParse(json);
  if (!parsed.success) {
    throw new Error(`The ${providerId} model returned an unexpected story shape.`);
  }
  return parsed.data;
}

/* -------------------------------- registry -------------------------------- */

const DEFAULT_PROVIDER = "gemini";

type ProviderFactory = () => Promise<StoryProvider>;

const PROVIDERS: Record<string, ProviderFactory> = {
  gemini: async () => (await import("@/lib/ai/gemini")).createGeminiProvider(),
};

/**
 * Picks the provider named by `AI_PROVIDER`, defaulting to Gemini.
 *
 * Factories are imported lazily so an unused provider's SDK never loads.
 */
export async function resolveStoryProvider(): Promise<StoryProvider> {
  const requested = (readEnv("AI_PROVIDER") ?? DEFAULT_PROVIDER).toLowerCase();
  const factory = PROVIDERS[requested];

  if (!factory) {
    throw new Error(
      `AI_PROVIDER is set to "${requested}", which ourTailTales does not support. Supported providers: ${Object.keys(PROVIDERS).join(", ")}.`,
    );
  }

  return factory();
}
