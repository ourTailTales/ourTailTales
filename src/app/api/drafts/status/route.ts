import { resolveDraft } from "@/lib/drafts/resolve";
import { routeError } from "@/lib/env";
import { supabaseAdmin } from "@/lib/supabase/server";

/**
 * When this browser's free preview expires.
 *
 * The expiry is returned once, by the upload that banks the teaser. A book
 * saved before the browser started keeping that answer comes back from a
 * reload without it, and the expiry banner then had nothing to show. This
 * lets the page ask again.
 *
 * Authenticated with the draft credentials, like everything else keyed on a
 * draft: a bare id would let anyone read another book's deadline.
 */
export async function GET(request: Request): Promise<Response> {
  try {
    const draft = await resolveDraft(request);
    if (!draft) {
      return Response.json({ error: "Unknown draft." }, { status: 401 });
    }

    const { data, error } = await supabaseAdmin()
      .from("book_drafts")
      .select("expires_at, digital_purchased_at, pdf_stored_at")
      .eq("id", draft.id)
      .maybeSingle();
    if (error) throw new Error(error.message);

    return Response.json({
      banked: Boolean(data?.pdf_stored_at),
      expiresAt: data?.digital_purchased_at ? null : (data?.expires_at ?? null),
    });
  } catch (error) {
    return routeError(error, "The book's status could not be read.");
  }
}
