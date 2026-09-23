import { routeError } from "@/lib/env";
import { hashDraftSecret, newDraftSecret } from "@/lib/drafts/token";
import { supabaseAdmin } from "@/lib/supabase/server";
import { LIMITS, enforceRateLimit } from "@/lib/rate-limit";

export async function POST(request: Request): Promise<Response> {
  try {
    const limited = await enforceRateLimit(request, LIMITS.draft);
    if (limited) return limited;

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
