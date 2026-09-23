import { z } from "zod";

import { resolveDraft } from "@/lib/drafts/resolve";
import { routeError } from "@/lib/env";
import { requireOrderToken } from "@/lib/order/token";
import { includedUniqueVideoIds } from "@/lib/video-memory/count";
import { centsToUsd, videoMemoryQuote } from "@/lib/video-memory/pricing";
import { supabaseAdmin } from "@/lib/supabase/server";
import type { FrozenBookRevision } from "@/types/video-memory";

const placementSchema = z.object({
  id: z.string(),
  type: z.literal("video-memory"),
  videoAssetId: z.string().uuid(),
  pageId: z.string(),
  title: z.string().optional(),
  caption: z.string().optional(),
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number(),
  zIndex: z.number().optional(),
});

/**
 * Records what is actually going to be printed, and what the Video Memories on
 * it cost.
 *
 * Two things gate it. The order's token, because this rewrites the contents of
 * somebody's order. And the absence of a PaymentIntent, because this is what
 * the price is computed from: left open afterwards, a customer could take a
 * quote for one Video Memory, re-freeze with twenty, and confirm the payment
 * they were already holding. The quote and the thing quoted have to stop
 * moving at the same moment.
 */
const requestSchema = z.object({
  orderId: z.string().uuid(),
  pages: z.array(
    z.object({
      id: z.string(),
      pageNumber: z.number().int().positive(),
      kind: z.string(),
    }),
  ),
  placements: z.array(placementSchema),
});

export async function POST(request: Request): Promise<Response> {
  try {
    const parsed = requestSchema.safeParse(await request.json());
    if (!parsed.success) {
      return Response.json({ error: "The book could not be frozen." }, { status: 400 });
    }

    const unauthorized = requireOrderToken(request, parsed.data.orderId);
    if (unauthorized) return unauthorized;

    const draft = await resolveDraft(request);

    const supabase = supabaseAdmin();
    const { data: order } = await supabase
      .from("orders")
      .select(
        "id, status, draft_id, interior_path, cover_path, stripe_payment_intent_id",
      )
      .eq("id", parsed.data.orderId)
      .maybeSingle();
    if (!order || order.status !== "pending_payment") {
      return Response.json({ error: "Unknown order." }, { status: 404 });
    }
    // An order that came from a book must be frozen by whoever holds that
    // book. This used to skip the check entirely when no credentials were
    // presented, which made presenting none the way past it.
    if (order.draft_id && draft?.id !== order.draft_id) {
      return Response.json({ error: "Unknown draft." }, { status: 401 });
    }
    // The quote has already been taken. Changing what is in the book now
    // changes what it should have cost.
    if (order.stripe_payment_intent_id) {
      return Response.json(
        {
          error:
            "This order has already been priced. Start a new order to change the book.",
        },
        { status: 409 },
      );
    }
    if (!order.interior_path || !order.cover_path) {
      return Response.json(
        { error: "Your print files are still uploading. Please try again." },
        { status: 409 },
      );
    }

    const uniqueIds = includedUniqueVideoIds(parsed.data.placements);
    const { data: assets, error: assetError } = await supabase
      .from("video_assets")
      .select(
        "id, status, processed_path, processed_bytes, content_sha256, duration_ms, processed_width, processed_height",
      )
      .in("id", uniqueIds.length ? uniqueIds : ["00000000-0000-0000-0000-000000000000"]);

    if (assetError) throw new Error(assetError.message);

    const processedVideos = [];
    for (const id of uniqueIds) {
      const asset = (assets ?? []).find((row) => row.id === id);
      if (!asset || asset.status !== "ready" || !asset.processed_path || !asset.content_sha256) {
        return Response.json(
          { error: "Every placed Video Memory must be ready before checkout." },
          { status: 409 },
        );
      }
      processedVideos.push({
        videoAssetId: asset.id,
        processedPath: asset.processed_path,
        processedBytes: Number(asset.processed_bytes),
        contentSha256: asset.content_sha256,
        durationMs: asset.duration_ms ?? 0,
        width: asset.processed_width ?? 0,
        height: asset.processed_height ?? 0,
      });
    }

    const snapshot: FrozenBookRevision = {
      pages: parsed.data.pages,
      placements: parsed.data.placements,
      processedVideos,
    };
    const quote = videoMemoryQuote(uniqueIds.length);

    const { error } = await supabase
      .from("orders")
      .update({
        book_snapshot: snapshot,
        frozen_interior_path: order.interior_path,
        interior_path: uniqueIds.length > 0 ? null : order.interior_path,
        selected_video_count: quote.includedUniqueVideoCount,
        video_memory_pack_count: quote.packCount,
        video_memory_pack_unit_price_cents: quote.unitPriceCents,
        video_memory_total_cents: quote.totalCents,
      })
      .eq("id", order.id);
    if (error) throw new Error(error.message);

    return Response.json({
      ok: true,
      selectedVideoCount: quote.includedUniqueVideoCount,
      videoMemoryPrice: centsToUsd(quote.totalCents),
    });
  } catch (error) {
    return routeError(error, "The book could not be frozen.");
  }
}
