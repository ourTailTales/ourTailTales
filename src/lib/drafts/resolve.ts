import { draftSecretFromRequest, secretsMatch } from "@/lib/drafts/token";
import { supabaseAdmin } from "@/lib/supabase/server";

export async function resolveDraft(request: Request): Promise<{
  id: string;
} | null> {
  const secret = draftSecretFromRequest(request);
  const draftId = request.headers.get("x-draft-id");
  if (!secret || !draftId) return null;

  const { data, error } = await supabaseAdmin()
    .from("book_drafts")
    .select("id, secret_hash")
    .eq("id", draftId)
    .maybeSingle();

  if (error || !data) return null;
  if (!secretsMatch(secret, data.secret_hash)) return null;
  return { id: data.id };
}
