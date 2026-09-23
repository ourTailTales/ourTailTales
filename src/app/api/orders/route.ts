import { z } from "zod";

import { routeError } from "@/lib/env";
import {
  captureServerEvent,
  captureServerException,
  postHogDistinctId,
} from "@/lib/posthog-server";
import {
  BASE_CHAPTERS,
  MAX_CHAPTERS,
  bookPrice,
  luluInteriorPages,
  storyPages,
} from "@/lib/pricing";
import { mintOrderToken } from "@/lib/order/token";
import { LIMITS, enforceRateLimit } from "@/lib/rate-limit";
import { supabaseAdmin } from "@/lib/supabase/server";

const requestSchema = z.object({
  petName: z.string().max(80).default(""),
  chapterCount: z.number().int().min(BASE_CHAPTERS).max(MAX_CHAPTERS),
  email: z.string().email().max(200).nullable().optional(),
  draftId: z.string().uuid().optional(),
});

/**
 * Opens an order in `pending_payment`.
 *
 * Page counts and the book price are always recomputed here from the chapter
 * count. A price sent by the browser is never trusted.
 *
 * Returns a token alongside the id. From here on, every route that changes
 * this order wants it: the id alone is an identifier, not a credential.
 */
export async function POST(request: Request): Promise<Response> {
  try {
    // Nothing authenticates this route — it is where a funnel begins — so the
    // only thing standing between a script and unbounded rows is this.
    const limited = await enforceRateLimit(request, LIMITS.draft);
    if (limited) return limited;

    const parsed = requestSchema.safeParse(await request.json());
    if (!parsed.success) {
      return Response.json(
        { error: "That book size isn't one we can print." },
        { status: 400 },
      );
    }

    const { petName, chapterCount, email, draftId } = parsed.data;
    const orderId = crypto.randomUUID();

    const { error } = await supabaseAdmin().from("orders").insert({
      id: orderId,
      email: email ?? null,
      pet_name: petName || null,
      chapter_count: chapterCount,
      story_pages: storyPages(chapterCount),
      total_pages: luluInteriorPages(chapterCount),
      book_price: bookPrice(chapterCount),
      draft_id: draftId ?? null,
      status: "pending_payment",
    });

    if (error) throw new Error(error.message);

    await captureServerEvent(postHogDistinctId(request, orderId), "order_created", {
      chapters: chapterCount,
      total_pages: luluInteriorPages(chapterCount),
      book_price: bookPrice(chapterCount),
      has_draft: Boolean(draftId),
    });

    return Response.json({
      orderId,
      orderToken: mintOrderToken(orderId),
      totalPages: luluInteriorPages(chapterCount),
      bookPrice: bookPrice(chapterCount),
    });
  } catch (error) {
    await captureServerException(
      error,
      postHogDistinctId(request, "server_order_request"),
    );
    return routeError(error, "Your order could not be started.");
  }
}
