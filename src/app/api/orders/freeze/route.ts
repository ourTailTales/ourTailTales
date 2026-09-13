import { z } from "zod";

import { resolveDraft } from "@/lib/drafts/resolve";
import { routeError } from "@/lib/env";
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
    const draft = await resolveDraft(request);
    const parsed = requestSchema.safeParse(await request.json());
    if (!parsed.success) {
      return Response.json({ error: "The book could not be frozen." }, { status: 400 });
    }

    const supabase = supabaseAdmin();
    const { data: order } = await supabase
      .from("orders")
      .select("id, status, draft_id, interior_path, cover_path")
      .eq("id", parsed.data.orderId)
      .maybeSingle();
    if (!order || order.status !== "pending_payment") {
      return Response.json({ error: "Unknown order." }, { status: 404 });
    }
    if (draft && order.draft_id && draft.id !== order.draft_id) {
      return Response.json({ error: "Unknown draft." }, { status: 401 });
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
