import { z } from "zod";

import { readEnv } from "@/lib/env";
import type {
  PetProfile,
  ProfileRequest,
  StoryDraft,
  StoryRequest,
} from "@/types/story";

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
    options?: GenerateOptions,
  ): Promise<StoryDraft>;
  /** One look at the pet: appearance, what they wear, and book palettes. */
  generateProfile(
    request: ProfileRequest,
    signal?: AbortSignal,
    options?: GenerateOptions,
  ): Promise<PetProfile>;
};

/** What one model call cost, so spend per book can be measured. */
export type AiUsage = {
  kind: "chapter" | "profile";
  model: string;
  inputTokens: number;
  outputTokens: number;
  thinkingTokens: number;
  images: number;
};

export type GenerateOptions = {
  /** Called once per model call, including a retry. */
  onUsage?: (usage: AiUsage) => void;
};

/**
 * Server-side validation of every chapter draft, whatever provider produced it.
 * Structured output makes the shape likely; Zod makes it required.
 */
export const ChapterStorySchema = z.object({
  title: z.string().min(1),
  dateLabel: z.string(),
  blurb: z.string().min(1),
  /**
   * The page grouping. Optional and unchecked beyond its shape: the book
   * reconciles it against the chapter's own photographs before printing
   * anything (`lib/book/page-plan`), so a model that miscounts costs the
   * chapter its grouping, never a photograph.
   */
  pages: z.array(z.array(z.number().int().nonnegative().max(500)).max(50)).max(50).optional(),
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

  const parsed = ChapterStorySchema.safeParse(json);
  if (!parsed.success) {
    throw new Error(
      `The ${providerId} model returned an unexpected story shape.`,
    );
  }
  return parsed.data;
}

const HEX = z.string().regex(/^#?[0-9a-fA-F]{6}$/).transform((value) =>
  value.startsWith("#") ? value.toLowerCase() : `#${value.toLowerCase()}`,
);

const PaletteSchema = z.object({
  name: z.string().min(1).max(60),
  reason: z.string().max(200).default(""),
  paper: HEX,
  ink: HEX,
  accent: HEX,
  tape: z.array(HEX).min(1).max(6),
  scraps: z.array(HEX).min(1).max(6),
  doodle: HEX,
});

/**
 * The profile, validated. Palettes that fail are dropped rather than failing
 * the whole profile: one good palette and the pet's description are still
 * worth having, and the book falls back to its classic colors without any.
 */
export const PetProfileSchema = z.object({
  appearance: z.string().max(300).default(""),
  accessories: z
    .array(z.object({ item: z.string().max(60), color: z.string().max(60) }))
    .max(8)
    .default([]),
  motifs: z.array(z.string().max(80)).max(8).default([]),
  palettes: z.array(z.unknown()).max(5).default([]),
});

export function parsePetProfile(raw: string, providerId: string): PetProfile {
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    throw new Error(`The ${providerId} model did not return usable JSON.`);
  }
  const parsed = PetProfileSchema.safeParse(json);
  if (!parsed.success) {
    throw new Error(`The ${providerId} model returned an unexpected profile shape.`);
  }
  return {
    appearance: parsed.data.appearance.trim(),
    accessories: parsed.data.accessories.slice(0, 5),
    motifs: parsed.data.motifs.slice(0, 4),
    palettes: parsed.data.palettes.flatMap((palette) => {
      const result = PaletteSchema.safeParse(palette);
      return result.success ? [result.data] : [];
    }).slice(0, 3),
  };
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
