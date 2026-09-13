import { routeError } from "@/lib/env";
import { hashDraftSecret, newDraftSecret } from "@/lib/drafts/token";
import { supabaseAdmin } from "@/lib/supabase/server";

export async function POST(): Promise<Response> {
  try {
    const secret = newDraftSecret();
    const id = crypto.randomUUID();
    const { error } = await supabaseAdmin().from("book_drafts").insert({
      id,
      secret_hash: hashDraftSecret(secret),
    });
    if (error) throw new Error(error.message);
    return Response.json({ draftId: id, secret });
  } catch (error) {
    return routeError(error, "A draft could not be created.");
  }
}
