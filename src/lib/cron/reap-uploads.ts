import {
  DRAFT_BANK_KINDS,
  draftIncomingPdfPath,
  draftPdfPath,
} from "@/lib/drafts/storage";
import { PREVIEW_BUCKET, supabaseAdmin } from "@/lib/supabase/server";

/**
 * Daily removal of book files nothing else ever removes.
 *
 * The expiry sweep only looks at drafts that have a free preview with a date
 * on it. Two kinds of file fall outside that and stayed for good:
 *
 * 1. Staging uploads. The browser uploads a book to a staging path and then
 *    asks the server to check and keep it. If that second step never comes (a
 *    closed tab, a refused file, a script that only ever asks for upload
 *    links), the staging file is left behind, and on a draft that was never
 *    banked at all nothing was ever going to come for it.
 * 2. The clean copy saved at hardcover checkout, on a draft with no free
 *    preview, when the checkout was then abandoned.
 *
 * Both are found by name, so nothing is listed and nothing is guessed at.
 */

/** Staging files are removed once the draft is this old. A bank takes minutes. */
const STAGING_MIN_AGE_DAYS = 2;
/**
 * And no longer looked at after this. Each draft is passed over a handful of
 * times and then left alone, so the nightly cost does not grow with every
 * draft ever made. A staging file left later than this on a draft with a
 * preview is removed by the expiry sweep, which names the same paths.
 */
const STAGING_MAX_AGE_DAYS = 9;
/** An abandoned checkout's clean copy is kept this long, then removed. */
const ORPHAN_CLEAN_AGE_DAYS = 30;

const BATCH = 300;
const REMOVE_CHUNK = 500;

const daysAgo = (days: number): string =>
  new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

export async function reapAbandonedUploads(): Promise<Record<string, unknown>> {
  const supabase = supabaseAdmin();
  const storage = supabase.storage.from(PREVIEW_BUCKET);

  const remove = async (paths: string[]): Promise<void> => {
    for (let index = 0; index < paths.length; index += REMOVE_CHUNK) {
      const { error } = await storage.remove(paths.slice(index, index + REMOVE_CHUNK));
      // Removing a path that is not there is not an error. A real failure
      // only strands files until tomorrow's run.
      if (error) console.error("[ourTailTales] Could not reap uploads", error);
    }
  };

  /* ------------------------------ staging ------------------------------ */

  const { data: recent, error: recentError } = await supabase
    .from("book_drafts")
    .select("id")
    .lt("created_at", daysAgo(STAGING_MIN_AGE_DAYS))
    .gt("created_at", daysAgo(STAGING_MAX_AGE_DAYS))
    .order("created_at", { ascending: true })
    .limit(BATCH);
  if (recentError) throw new Error(recentError.message);

  const stagingPaths = (recent ?? []).flatMap((draft) =>
    DRAFT_BANK_KINDS.map((kind) => draftIncomingPdfPath(draft.id, kind)),
  );
  await remove(stagingPaths);

  /* ------------------- clean copies of abandoned checkouts ------------------- */

  const { data: orphans, error: orphanError } = await supabase
    .from("book_drafts")
    .select("id")
    .is("pdf_storage_path", null)
    .not("clean_pdf_storage_path", "is", null)
    .is("digital_purchased_at", null)
    .lt("updated_at", daysAgo(ORPHAN_CLEAN_AGE_DAYS))
    .limit(BATCH);
  if (orphanError) throw new Error(orphanError.message);

  let cleanRemoved = 0;
  const orphanIds = (orphans ?? []).map((draft) => draft.id);
  if (orphanIds.length > 0) {
    // A hardcover that was paid for keeps its PDF copy, whatever state the
    // draft's own columns are in.
    const { data: paid, error: paidError } = await supabase
      .from("orders")
      .select("draft_id")
      .in("draft_id", orphanIds)
      .not("status", "in", "(pending_payment,canceled)");
    if (paidError) throw new Error(paidError.message);
    const keep = new Set((paid ?? []).map((order) => order.draft_id));
    const reapable = orphanIds.filter((id) => !keep.has(id));

    if (reapable.length > 0) {
      // The pointer first, the file second, and only for rows that changed:
      // a purchase landing in between keeps its file.
      const { data: cleared, error: clearError } = await supabase
        .from("book_drafts")
        .update({
          clean_pdf_storage_path: null,
          updated_at: new Date().toISOString(),
        })
        .in("id", reapable)
        .is("digital_purchased_at", null)
        .is("pdf_storage_path", null)
        .select("id");
      if (clearError) throw new Error(clearError.message);
      const clearedIds = (cleared ?? []).map((row) => row.id);
      await remove(clearedIds.map((id) => draftPdfPath(id, "clean")));
      cleanRemoved = clearedIds.length;
    }
  }

  return {
    draftsChecked: recent?.length ?? 0,
    stagingPathsRemoved: stagingPaths.length,
    abandonedCleanCopiesRemoved: cleanRemoved,
  };
}
