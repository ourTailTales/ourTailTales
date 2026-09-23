import { z } from "zod";

import { resolveStoryProvider } from "@/lib/ai/provider";
import { routeError } from "@/lib/env";
import { LIMITS, enforceRateLimit } from "@/lib/rate-limit";

/**
 * Chapter title and blurb generation.
 *
 * This handler knows nothing about which model writes the copy — it validates
 * the chapter, hands it to whichever provider `AI_PROVIDER` names, and returns
 * the draft. The provider key stays in this process; the representative
 * thumbnails are forwarded to the model and never written to disk or Supabase.
 */

const requestSchema = z.object({
  petName: z.string().max(80),
  lifespan: z.string().max(40).optional().default(""),
  dateLabel: z.string().max(60).optional().default(""),
  photoCount: z.number().int().nonnegative(),
  selectedCount: z.number().int().nonnegative(),
  places: z
    .array(
      z.object({
        city: z.string().optional(),
        region: z.string().optional(),
        country: z.string().optional(),
      }),
    )
    .max(5)
    .default([]),
  seasons: z.array(z.string().max(60)).max(4).default([]),
  // Three to five is the product rule; the cap is what this route will accept.
  thumbnails: z.array(z.string().max(4_000_000)).max(5).default([]),
});

export async function POST(request: Request): Promise<Response> {
  try {
    const limited = await enforceRateLimit(request, LIMITS.story);
    if (limited) return limited;

    const parsed = requestSchema.safeParse(await request.json());
    if (!parsed.success) {
      return Response.json(
        { error: "That chapter could not be read." },
        { status: 400 },
      );
    }

    const provider = await resolveStoryProvider();
    const draft = await provider.generateStory(parsed.data, request.signal);

    return Response.json(draft);
  } catch (error) {
    return routeError(error, "Story generation failed.");
  }
}
