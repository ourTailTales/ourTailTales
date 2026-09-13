import { z } from "zod";

import { resolveDraft } from "@/lib/drafts/resolve";
import { routeError } from "@/lib/env";
import { supabaseAdmin } from "@/lib/supabase/server";

const patchSchema = z.object({
  pageId: z.string().min(1).max(80).optional(),
  title: z.string().max(80).optional(),
  caption: z.string().max(160).optional(),
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
      return Response.json({ error: "That placement could not be updated." }, { status: 400 });
    }

    const update: Record<string, unknown> = {};
    if (parsed.data.pageId) update.page_id = parsed.data.pageId;
    if (parsed.data.title !== undefined) update.title = parsed.data.title;
    if (parsed.data.caption !== undefined) update.caption = parsed.data.caption;

    const { error } = await supabaseAdmin()
      .from("video_memory_placements")
      .update(update)
      .eq("id", id)
      .eq("draft_id", draft.id);
    if (error) throw new Error(error.message);
    return Response.json({ ok: true });
  } catch (error) {
    return routeError(error, "That placement could not be updated.");
  }
}

/** Remove from this page only. Never deletes the video asset. */
export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    const draft = await resolveDraft(request);
    if (!draft) return Response.json({ error: "Unknown draft." }, { status: 401 });
    const { id } = await context.params;

    const { error } = await supabaseAdmin()
      .from("video_memory_placements")
      .delete()
      .eq("id", id)
      .eq("draft_id", draft.id);
    if (error) throw new Error(error.message);
    return Response.json({ ok: true });
  } catch (error) {
    return routeError(error, "That placement could not be removed.");
  }
}
