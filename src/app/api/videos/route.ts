import { resolveDraft } from "@/lib/drafts/resolve";
import { routeError } from "@/lib/env";
import { STORAGE_BUCKET, supabaseAdmin } from "@/lib/supabase/server";

export async function GET(request: Request): Promise<Response> {
  try {
    const draft = await resolveDraft(request);
    if (!draft) {
      return Response.json({ error: "Unknown draft." }, { status: 401 });
    }

    const { data, error } = await supabaseAdmin()
      .from("video_assets")
      .select(
        "id, draft_id, title, original_path, processed_path, thumbnail_path, duration_ms, original_bytes, processed_bytes, processed_width, processed_height, content_sha256, status, processing_error_code, created_at, updated_at",
      )
      .eq("draft_id", draft.id)
      .order("created_at", { ascending: true });

    if (error) throw new Error(error.message);

    const assets = await Promise.all(
      (data ?? []).map(async (row) => {
        let previewUrl: string | null = null;
        const previewPath = row.processed_path ?? row.thumbnail_path;
        if (previewPath) {
          const signed = await supabaseAdmin()
            .storage.from(STORAGE_BUCKET)
            .createSignedUrl(previewPath, 60 * 30);
          previewUrl = signed.data?.signedUrl ?? null;
        }
        return {
          id: row.id,
          draftId: row.draft_id,
          title: row.title,
          originalPath: row.original_path,
          processedPath: row.processed_path,
          thumbnailPath: row.thumbnail_path,
          previewUrl,
          durationMs: row.duration_ms,
          originalBytes: Number(row.original_bytes),
          processedBytes: row.processed_bytes === null ? null : Number(row.processed_bytes),
          processedWidth: row.processed_width,
          processedHeight: row.processed_height,
          contentSha256: row.content_sha256,
          status: row.status,
          processingErrorCode: row.processing_error_code,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        };
      }),
    );

    const { data: placements, error: placeError } = await supabaseAdmin()
      .from("video_memory_placements")
      .select("id, video_asset_id, page_id, title, caption, x, y, width, height, z_index")
      .eq("draft_id", draft.id);

    if (placeError) throw new Error(placeError.message);

    return Response.json({
      assets,
      placements: (placements ?? []).map((row) => ({
        id: row.id,
        type: "video-memory" as const,
        videoAssetId: row.video_asset_id,
        pageId: row.page_id,
        title: row.title ?? undefined,
        caption: row.caption ?? undefined,
        x: row.x,
        y: row.y,
        width: row.width,
        height: row.height,
        zIndex: row.z_index ?? undefined,
      })),
    });
  } catch (error) {
    return routeError(error, "Video Memories could not be loaded.");
  }
}
