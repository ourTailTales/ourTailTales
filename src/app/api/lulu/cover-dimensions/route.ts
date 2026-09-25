import { z } from "zod";

import { routeError } from "@/lib/env";
import { fetchCoverDimensions } from "@/lib/lulu/client";
import { LIMITS, enforceRateLimit } from "@/lib/rate-limit";
import {
  MAX_CHAPTERS,
  MIN_PRINTABLE_INTERIOR_PAGES,
  luluInteriorPages,
} from "@/lib/pricing";

const requestSchema = z.object({
  pageCount: z
    .number()
    .int()
    .min(MIN_PRINTABLE_INTERIOR_PAGES)
    .max(luluInteriorPages(MAX_CHAPTERS)),
});

/**
 * The cover's real size, straight from Lulu. Spine width depends on the paper
 * stock behind the pod package and the interior page count, so it is never
 * calculated locally.
 */
export async function POST(request: Request): Promise<Response> {
  try {
    const limited = await enforceRateLimit(request, LIMITS.lulu);
    if (limited) return limited;

    const parsed = requestSchema.safeParse(await request.json());
    if (!parsed.success) {
      return Response.json(
        { error: "That page count isn't a book we print." },
        { status: 400 },
      );
    }

    const { pageCount } = parsed.data;

    // A book is as long as its chapters turned out to be, so the old
    // "chapters * 10 + 4" shape no longer holds — only the binder's own
    // rules do: at least the minimum, and a whole number of leaves.
    if (pageCount % 2 !== 0) {
      return Response.json(
        { error: "That page count isn't a book we print." },
        { status: 400 },
      );
    }

    const dimensions = await fetchCoverDimensions(pageCount);
    return Response.json(dimensions);
  } catch (error) {
    return routeError(error, "Your cover size could not be calculated.");
  }
}
