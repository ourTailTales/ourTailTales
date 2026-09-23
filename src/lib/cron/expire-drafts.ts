import { PREVIEW_BUCKET, supabaseAdmin } from "@/lib/supabase/server";

/**
 * Daily reaping of free preview books.
 *
 * A free book is kept for 30 days. Any purchase — the $4.99 PDF or a hardcover
 * order — makes it permanent, so this only ever touches drafts that were never
 * paid for.
 *
 * The stored PDFs are deleted and the row is anonymised rather than dropped:
 * `orders` and `video_assets` both carry foreign keys to `book_drafts`, so
 * deleting the row would cascade into paid history. Clearing the paths and the
 * pet name removes everything personal while leaving those references intact.
 */

/** Batch size per run. Keeps one pass well inside a function's time budget. */
const BATCH = 200;

/**
 * Extracted from the route handler so the daily dispatcher can call it
 * directly, without a second HTTP hop or a second cold start.
 */
export async function expireDrafts(): Promise<Record<string, unknown>> {
  const supabase = supabaseAdmin();
  const now = new Date().toISOString();

  const { data: expired, error } = await supabase
    .from("book_drafts")
    .select("id, pdf_storage_path, clean_pdf_storage_path")
    .lt("expires_at", now)
    .is("digital_purchased_at", null)
    // Already-reaped rows keep their expiry timestamp so the book page can
    // still explain itself; without this they would be re-swept every night.
    .not("pdf_storage_path", "is", null)
    .limit(BATCH);

  if (error) throw new Error(error.message);
  if (!expired || expired.length === 0) {
    return { expired: 0, filesDeleted: 0 };
  }

  // A hardcover order keeps the book too, and those live in `orders` rather
  // than on the draft. Checked explicitly so a printed book's source is
  // never reaped out from under it.
  const candidateIds = expired.map((draft) => draft.id);
  const { data: paidOrders, error: ordersError } = await supabase
    .from("orders")
    .select("draft_id")
    .in("draft_id", candidateIds)
    .not("status", "in", "(pending_payment,canceled)");

  if (ordersError) throw new Error(ordersError.message);

  const keep = new Set(
    (paidOrders ?? [])
      .map((order) => order.draft_id)
      .filter((id): id is string => typeof id === "string"),
  );

  const reapable = expired.filter((draft) => !keep.has(draft.id));
  if (reapable.length === 0) {
    return { expired: 0, filesDeleted: 0, keptForOrders: keep.size };
  }

  const paths = reapable.flatMap((draft) =>
    [draft.pdf_storage_path, draft.clean_pdf_storage_path].filter(
      (path): path is string => typeof path === "string" && path.length > 0,
    ),
  );

  if (paths.length > 0) {
    const { error: removeError } = await supabase.storage
      .from(PREVIEW_BUCKET)
      .remove(paths);
    // Storage and the table are not one transaction. A failed delete must
    // not clear the paths, or the files would be orphaned with nothing left
    // pointing at them — leaving the row alone means the next run retries.
    if (removeError) throw new Error(removeError.message);
  }

  const { error: anonymiseError } = await supabase
    .from("book_drafts")
    .update({
      pdf_storage_path: null,
      clean_pdf_storage_path: null,
      pet_name: "",
      chapter_count: null,
      // `pdf_stored_at` and `expires_at` are deliberately kept. Neither is
      // personal, and together they are what tells the book page this link
      // was a real book that has since expired, rather than a dead URL.
      updated_at: now,
    })
    .in(
      "id",
      reapable.map((draft) => draft.id),
    );

  if (anonymiseError) throw new Error(anonymiseError.message);

  return {
      expired: reapable.length,
      filesDeleted: paths.length,
      keptForOrders: keep.size,
    };
}
