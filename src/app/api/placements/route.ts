import { z } from "zod";

import { resolveDraft } from "@/lib/drafts/resolve";
import { routeError } from "@/lib/env";
import { defaultVideoMemoryBox, meetsMinimumQrSize } from "@/lib/video-memory/geometry";
import { supabaseAdmin } from "@/lib/supabase/server";

const requestSchema = z.object({
  videoAssetId: z.string().uuid(),
  pageId: z.string().min(1).max(80),
  title: z.string().max(80).optional(),
  caption: z.string().max(160).optional(),
});

export async function POST(request: Request): Promise<Response> {
  try {
    const draft = await resolveDraft(request);
    if (!draft) return Response.json({ error: "Unknown draft." }, { status: 401 });

    const parsed = requestSchema.safeParse(await request.json());
    if (!parsed.success) {
      return Response.json({ error: "Choose a page for this Video Memory." }, { status: 400 });
    }

    const { data: asset } = await supabaseAdmin()
      .from("video_assets")
      .select("id, title")
      .eq("id", parsed.data.videoAssetId)
      .eq("draft_id", draft.id)
      .maybeSingle();
    if (!asset) {
      return Response.json({ error: "Unknown Video Memory." }, { status: 404 });
    }

    const box = defaultVideoMemoryBox();
    if (!meetsMinimumQrSize(box)) {
      return Response.json({ error: "That QR would be too small to print." }, { status: 400 });
    }

    const id = crypto.randomUUID();
    const { error } = await supabaseAdmin().from("video_memory_placements").insert({
      id,
      draft_id: draft.id,
      video_asset_id: asset.id,
      page_id: parsed.data.pageId,
      title: parsed.data.title ?? asset.title,
      caption: parsed.data.caption ?? "Watch this memory",
      x: box.x,
      y: box.y,
      width: box.width,
      height: box.height,
    });
    if (error) throw new Error(error.message);

    return Response.json({
      placement: {
        id,
        type: "video-memory",
        videoAssetId: asset.id,
        pageId: parsed.data.pageId,
        title: parsed.data.title ?? asset.title,
        caption: parsed.data.caption ?? "Watch this memory",
        ...box,
      },
    });
  } catch (error) {
    return routeError(error, "That Video Memory could not be placed.");
  }
}
