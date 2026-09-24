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

/**
 * A vision call with four thumbnails attached routinely runs past the
 * platform default, and this route had no budget declared at all, so chapters
 * came back as 504s at the single most expensive moment in the funnel.
 */
export const maxDuration = 60;

const requestSchema = z.object({
  petName: z.string().max(80),
  species: z.string().max(40).optional(),
  stillHere: z.boolean().optional(),
  // Capped tight: it is one line about a pet, and anything longer arriving
  // here is not that.
  notes: z.string().max(240).optional(),
  lifespan: z.string().max(40).optional().default(""),
  dateLabel: z.string().max(60).optional().default(""),
  photoCount: z.number().int().nonnegative(),
  selectedCount: z.number().int().nonnegative(),
  places: z
    .array(
      z.object({
        // Capped like the other free-text fields: these reach the Gemini
        // prompt directly, and a real city/region/country name is never
        // anywhere near this long.
        city: z.string().max(80).optional(),
        region: z.string().max(80).optional(),
        country: z.string().max(80).optional(),
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
