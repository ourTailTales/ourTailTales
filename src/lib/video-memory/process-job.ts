import { videoProcessingProvider } from "@/lib/video-memory/processing/provider";
import { supabaseAdmin } from "@/lib/supabase/server";

const STALE_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 5;

export async function recoverStaleProcessing(): Promise<number> {
  const cutoff = new Date(Date.now() - STALE_MS).toISOString();
  const { data, error } = await supabaseAdmin()
    .from("video_assets")
    .update({
      status: "uploaded",
      processing_error_code: "stale_processing",
      processing_started_at: null,
    })
    .eq("status", "processing")
    .lt("processing_started_at", cutoff)
    .select("id");

  if (error) throw new Error(error.message);
  return data?.length ?? 0;
}

export async function processNextVideoAsset(): Promise<string | null> {
  const supabase = supabaseAdmin();
  const now = new Date().toISOString();

  const { data: candidates, error } = await supabase
    .from("video_assets")
    .select("id, original_path, processing_attempt_count")
    .in("status", ["uploaded", "failed"])
    .lt("processing_attempt_count", MAX_ATTEMPTS)
    .or(`processing_next_retry_at.is.null,processing_next_retry_at.lte.${now}`)
    .order("created_at", { ascending: true })
    .limit(1);

  if (error) throw new Error(error.message);
  const candidate = candidates?.[0];
  if (!candidate) return null;

  const { data: claimed, error: claimError } = await supabase
    .from("video_assets")
    .update({
      status: "processing",
      processing_started_at: now,
      processing_attempt_count: candidate.processing_attempt_count + 1,
    })
    .eq("id", candidate.id)
    .in("status", ["uploaded", "failed"])
    .select("id, original_path")
    .maybeSingle();

  if (claimError) throw new Error(claimError.message);
  if (!claimed) return null;

  try {
    const result = await videoProcessingProvider().processVideo({
      sourcePath: claimed.original_path,
      assetId: claimed.id,
    });

    const { error: saveError } = await supabase
      .from("video_assets")
      .update({
        status: "ready",
        processed_path: result.processedPath,
        thumbnail_path: result.thumbnailPath ?? null,
        processed_bytes: result.processedBytes,
        processed_width: result.width,
        processed_height: result.height,
        duration_ms: result.durationMs,
        content_sha256: result.sha256,
        processing_error_code: null,
        processing_next_retry_at: null,
        processing_started_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", claimed.id);

    if (saveError) throw new Error(saveError.message);
    return claimed.id;
  } catch (error) {
    const attempts = candidate.processing_attempt_count + 1;
    const delay = Math.min(60, 2 ** attempts) * 1000;
    await supabase
      .from("video_assets")
      .update({
        status: "failed",
        processing_error_code: "processing_failed",
        processing_next_retry_at: new Date(Date.now() + delay).toISOString(),
        processing_started_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", claimed.id);
    console.error("[ourTailTales] video processing failed", claimed.id, error);
    return claimed.id;
  }
}
