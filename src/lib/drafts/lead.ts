import { supabaseAdmin, supabaseConfigured } from "@/lib/supabase/server";

/**
 * The address this book was emailed to.
 *
 * Only ever read behind a verified draft secret, so the caller already holds
 * the credential for this book — it is their own address being handed back to
 * them so they do not have to type it again.
 */
export async function draftLeadEmail(draftId: string): Promise<string | null> {
  if (!supabaseConfigured()) return null;
  try {
    const { data } = await supabaseAdmin()
      .from("book_drafts")
      .select("lead_email")
      .eq("id", draftId)
      .maybeSingle();
    return (data?.lead_email as string | null) ?? null;
  } catch {
    // The column arrives with this release's migration; before it lands the
    // right answer is "we don't know", not a 500 on the claim page.
    return null;
  }
}
