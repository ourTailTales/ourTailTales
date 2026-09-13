import { z } from "zod";

import { resolveDraft } from "@/lib/drafts/resolve";
import { routeError } from "@/lib/env";
import { supabaseAdmin } from "@/lib/supabase/server";

const requestSchema = z.object({ assetId: z.string().uuid() });

/** Marks the direct upload complete. Does not transcode. */
export async function POST(request: Request): Promise<Response> {
  try {
    const draft = await resolveDraft(request);
    if (!draft) {
      return Response.json({ error: "Unknown draft." }, { status: 401 });
    }

    const parsed = requestSchema.safeParse(await request.json());
    if (!parsed.success) {
      return Response.json({ error: "Unknown video." }, { status: 400 });
    }

    const { error } = await supabaseAdmin()
      .from("video_assets")
      .update({
        status: "uploaded",
        processing_next_retry_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", parsed.data.assetId)
      .eq("draft_id", draft.id);

    if (error) throw new Error(error.message);
    return Response.json({ ok: true });
  } catch (error) {
    return routeError(error, "Upload could not be confirmed.");
  }
}
