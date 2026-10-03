import { resolveDraft } from "@/lib/drafts/resolve";
import { routeError } from "@/lib/env";
import { supabaseAdmin } from "@/lib/supabase/server";
import { videoMemoriesDisabledResponse } from "@/lib/video-memory/flag";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const disabled = videoMemoriesDisabledResponse();
  if (disabled) return disabled;

  try {
    const draft = await resolveDraft(request);
    if (!draft) return Response.json({ error: "Unknown draft." }, { status: 401 });
    const { id } = await context.params;

    const { error } = await supabaseAdmin()
      .from("video_assets")
      .update({
        status: "uploaded",
        processing_next_retry_at: new Date().toISOString(),
        processing_error_code: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("draft_id", draft.id)
      .eq("status", "failed");
    if (error) throw new Error(error.message);
    return Response.json({ ok: true });
  } catch (error) {
    return routeError(error, "That video could not be retried.");
  }
}
