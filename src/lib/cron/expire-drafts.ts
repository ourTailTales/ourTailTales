import { allDraftPdfPaths } from "@/lib/drafts/storage";
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

/** Storage refuses more keys than this in one call. */
const REMOVE_CHUNK = 500;

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

  // Someone may have bought their book in the seconds since the select above.
  // Checked again here, as late as possible, because the next thing this does
  // is delete files that a purchase makes permanent.
  const { data: justBought } = await supabase
    .from("book_drafts")
    .select("id")
    .in("id", candidateIds)
    .not("digital_purchased_at", "is", null);

  for (const row of justBought ?? []) keep.add(row.id);

  const reapable = expired.filter((draft) => !keep.has(draft.id));

  // A book somebody paid for is permanent, and saying so is what stops this
  // batch from filling up with rows it will never touch. They match the same
  // three predicates tomorrow, so once there are enough of them every run
  // selects only kept rows and reaps nothing, quietly, forever.
  if (keep.size > 0) {
    await supabase
      .from("book_drafts")
      .update({ expires_at: null, updated_at: now })
      .in("id", [...keep]);
  }

  if (reapable.length === 0) {
    return { expired: 0, filesDeleted: 0, keptForOrders: keep.size };
  }

  // The row is cleared first and the files second.
  //
  // Storage and the table are not one transaction, so one of the two has to
  // go first and the question is which failure is survivable. Deleting first
  // and failing the update leaves a paid book with a live pointer to bytes
  // that are gone: the page says the book is fine and the download 404s.
  // Clearing first and failing the delete leaves files nothing points at,
  // which costs storage and no customer notices. So: bookkeeping first, and
  // only rows that actually changed hands get their files removed.
  const { data: cleared, error: anonymiseError } = await supabase
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
    )
    // A purchase landing between the re-check above and this write keeps its
    // book: the row is skipped here, so its files are never queued for
    // deletion below either.
    .is("digital_purchased_at", null)
    .select("id");

  if (anonymiseError) throw new Error(anonymiseError.message);

  const clearedIds = (cleared ?? []).map((row) => row.id);
  const paths = clearedIds.flatMap((id) => allDraftPdfPaths(id));

  // Supabase caps one remove call at a thousand keys, and each draft owns
  // four, so a batch of two hundred is already close enough to chunk rather
  // than to hope about.
  for (let index = 0; index < paths.length; index += REMOVE_CHUNK) {
    const chunk = paths.slice(index, index + REMOVE_CHUNK);
    const { error: removeError } = await supabase.storage
      .from(PREVIEW_BUCKET)
      .remove(chunk);
    // The row is already cleared, so a failure here only strands files. Worth
    // a loud log and not worth failing the run over.
    if (removeError) {
      console.error("[ourTailTales] Could not reap draft files", removeError);
    }
  }

  return {
    expired: clearedIds.length,
    filesDeleted: paths.length,
    keptForOrders: keep.size,
  };
}
