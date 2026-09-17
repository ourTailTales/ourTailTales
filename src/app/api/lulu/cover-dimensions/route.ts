import { z } from "zod";

import { routeError } from "@/lib/env";
import { fetchCoverDimensions } from "@/lib/lulu/client";
import {
  BASE_CHAPTERS,
  FIXED_INTERIOR_PAGES,
  MAX_CHAPTERS,
  luluInteriorPages,
} from "@/lib/pricing";

const requestSchema = z.object({
  pageCount: z
    .number()
    .int()
    .min(luluInteriorPages(BASE_CHAPTERS))
    .max(luluInteriorPages(MAX_CHAPTERS)),
});

/**
 * The cover's real size, straight from Lulu. Spine width depends on the paper
 * stock behind the pod package and the interior page count, so it is never
 * calculated locally.
 */
export async function POST(request: Request): Promise<Response> {
  try {
    const parsed = requestSchema.safeParse(await request.json());
    if (!parsed.success) {
      return Response.json(
        { error: "That page count isn't a book we print." },
        { status: 400 },
      );
    }

    const { pageCount } = parsed.data;

    // Every book is chapters * 10 plus the four fixed pages.
    if ((pageCount - FIXED_INTERIOR_PAGES) % 10 !== 0) {
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
