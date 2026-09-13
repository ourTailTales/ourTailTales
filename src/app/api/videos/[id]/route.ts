import { z } from "zod";

import { resolveDraft } from "@/lib/drafts/resolve";
import { routeError } from "@/lib/env";
import { supabaseAdmin } from "@/lib/supabase/server";

const patchSchema = z.object({
  title: z.string().max(80).optional(),
});

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    const draft = await resolveDraft(request);
    if (!draft) return Response.json({ error: "Unknown draft." }, { status: 401 });
    const { id } = await context.params;
    const parsed = patchSchema.safeParse(await request.json());
    if (!parsed.success) {
      return Response.json({ error: "That title could not be saved." }, { status: 400 });
    }

    const { error } = await supabaseAdmin()
      .from("video_assets")
      .update({ title: parsed.data.title?.trim() ?? "", updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("draft_id", draft.id);
    if (error) throw new Error(error.message);
    return Response.json({ ok: true });
  } catch (error) {
    return routeError(error, "That Video Memory could not be updated.");
  }
}

/** Delete Video Memory: remove every placement, then the library row. */
export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    const draft = await resolveDraft(request);
    if (!draft) return Response.json({ error: "Unknown draft." }, { status: 401 });
    const { id } = await context.params;

    const { error: placeError } = await supabaseAdmin()
      .from("video_memory_placements")
      .delete()
      .eq("draft_id", draft.id)
      .eq("video_asset_id", id);
    if (placeError) throw new Error(placeError.message);

    const { error } = await supabaseAdmin()
      .from("video_assets")
      .delete()
      .eq("id", id)
      .eq("draft_id", draft.id);
    if (error) throw new Error(error.message);
    return Response.json({ ok: true });
  } catch (error) {
    return routeError(error, "That Video Memory could not be deleted.");
  }
}
