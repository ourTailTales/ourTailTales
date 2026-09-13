import { z } from "zod";

import { resolveDraft } from "@/lib/drafts/resolve";
import { routeError } from "@/lib/env";
import {
  DURATION_TOO_LONG_MESSAGE,
  VIDEO_MEMORY_MAX_DURATION_MS,
  sourceTooLargeMessage,
  videoMemoryOperationalMaxAssetsPerDraft,
} from "@/lib/video-memory/config";
import { effectiveUploadLimitBytes } from "@/lib/video-memory/storage-limit";
import { STORAGE_BUCKET, supabaseAdmin } from "@/lib/supabase/server";

const requestSchema = z.object({
  fileName: z.string().min(1).max(200),
  bytes: z.number().int().positive(),
  contentType: z.string().max(80).optional(),
  durationMs: z.number().positive().optional(),
  title: z.string().max(80).optional(),
});

export async function POST(request: Request): Promise<Response> {
  try {
    const draft = await resolveDraft(request);
    if (!draft) {
      return Response.json({ error: "Unknown draft." }, { status: 401 });
    }

    const parsed = requestSchema.safeParse(await request.json());
    if (!parsed.success) {
      return Response.json({ error: "Please choose a video file." }, { status: 400 });
    }

    if (
      parsed.data.durationMs !== undefined &&
      parsed.data.durationMs > VIDEO_MEMORY_MAX_DURATION_MS
    ) {
      return Response.json({ error: DURATION_TOO_LONG_MESSAGE }, { status: 400 });
    }

    const limits = await effectiveUploadLimitBytes();
    if (parsed.data.bytes > limits.effective) {
      return Response.json(
        { error: sourceTooLargeMessage(limits.effective) },
        { status: 400 },
      );
    }

    const { count, error: countError } = await supabaseAdmin()
      .from("video_assets")
      .select("id", { count: "exact", head: true })
      .eq("draft_id", draft.id);
    if (countError) throw new Error(countError.message);
    if ((count ?? 0) >= videoMemoryOperationalMaxAssetsPerDraft()) {
      return Response.json(
        { error: "Please wait before adding more videos." },
        { status: 429 },
      );
    }

    const assetId = crypto.randomUUID();
    const ext = extensionOf(parsed.data.fileName);
    const originalPath = `drafts/${draft.id}/videos/${assetId}/original.${ext}`;

    const { data: signed, error: signError } = await supabaseAdmin()
      .storage.from(STORAGE_BUCKET)
      .createSignedUploadUrl(originalPath, { upsert: true });
    if (signError || !signed) {
      throw new Error(signError?.message ?? "Upload could not be authorized.");
    }

    const { error: insertError } = await supabaseAdmin().from("video_assets").insert({
      id: assetId,
      draft_id: draft.id,
      title: parsed.data.title?.trim() || suggestedTitle(parsed.data.fileName),
      original_path: originalPath,
      original_bytes: parsed.data.bytes,
      duration_ms: parsed.data.durationMs ? Math.round(parsed.data.durationMs) : null,
      status: "uploaded",
    });
    if (insertError) throw new Error(insertError.message);

    return Response.json({
      assetId,
      path: originalPath,
      signedUrl: signed.signedUrl,
    });
  } catch (error) {
    return routeError(error, "That video could not be prepared for upload.");
  }
}

function extensionOf(fileName: string): string {
  const match = fileName.toLowerCase().match(/\.([a-z0-9]+)$/);
  if (match && ["mp4", "mov", "m4v", "webm"].includes(match[1])) return match[1];
  return "mp4";
}

function suggestedTitle(fileName: string): string {
  return fileName.replace(/\.[^.]+$/, "").slice(0, 60) || "Video Memory";
}
