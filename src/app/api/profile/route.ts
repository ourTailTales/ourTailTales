import { z } from "zod";

import { resolveStoryProvider } from "@/lib/ai/provider";
import { recordAiUsage } from "@/lib/ai/usage";
import { routeError } from "@/lib/env";
import { LIMITS, enforceRateLimit } from "@/lib/rate-limit";

/**
 * One look at the pet before a book is written: what they look like, what
 * they wear, and three color palettes for their pages.
 *
 * Like `/api/story`, the thumbnails are forwarded to the model and never
 * written to disk or Supabase.
 */
export const maxDuration = 60;

const requestSchema = z.object({
  petName: z.string().max(80),
  species: z.string().max(40).optional(),
  notes: z.string().max(240).optional(),
  thumbnails: z.array(z.string().max(4_000_000)).min(1).max(6),
});

export async function POST(request: Request): Promise<Response> {
  try {
    const limited = await enforceRateLimit(request, LIMITS.profile);
    if (limited) return limited;

    const parsed = requestSchema.safeParse(await request.json());
    if (!parsed.success) {
      return Response.json({ error: "Those photos could not be read." }, { status: 400 });
    }

    const provider = await resolveStoryProvider();
    const profile = await provider.generateProfile(parsed.data, request.signal, {
      onUsage: (usage) => void recordAiUsage(request, usage),
    });
    return Response.json(profile);
  } catch (error) {
    return routeError(error, "The book's colors could not be chosen.");
  }
}
