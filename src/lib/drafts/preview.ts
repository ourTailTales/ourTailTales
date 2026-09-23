import { secretsMatch } from "@/lib/drafts/token";
import { draftPdfPath } from "@/lib/drafts/storage";
import { PREVIEW_BUCKET, supabaseAdmin, supabaseConfigured } from "@/lib/supabase/server";

/** How long a preview link stays good for once minted. */
const SIGNED_URL_TTL_SECONDS = 600;

export type DraftPreview = {
  draftId: string;
  petName: string;
  chapterCount: number | null;
  /** Null once the draft has been bought — a paid book does not expire. */
  expiresAt: Date | null;
  expired: boolean;
  purchased: boolean;
  /** Absent when the draft has expired and its files have been reaped. */
  pdfUrl: string | null;
};

export type DraftRow = {
  id: string;
  secret_hash: string;
  pdf_storage_path: string | null;
  pdf_stored_at: string | null;
  clean_pdf_storage_path: string | null;
  expires_at: string | null;
  digital_purchased_at: string | null;
  pet_name: string | null;
  chapter_count: number | null;
};

/**
 * Loads a free preview book for the public `/book/<id>?k=<secret>` page.
 *
 * Returns null when this id is not a draft at all, so the caller can fall
 * through to the signed-in book view — and also when the secret is missing or
 * wrong, so a bad key is indistinguishable from an unknown book.
 */
export async function loadDraftPreview(
  draftId: string,
  secret: string | null,
): Promise<DraftPreview | null> {
  if (!secret || !supabaseConfigured()) return null;

  const supabase = supabaseAdmin();

  // This lookup runs ahead of the signed-in book view, so it must never be the
  // reason the page fails. supabase-js throws outright when the network is
  // down, and the select also errors until this release's migration has been
  // applied — in both cases the right answer is "not a draft", which falls
  // through to the account view rather than 500ing everyone's book.
  let row: DraftRow;
  try {
    const { data, error } = await supabase
      .from("book_drafts")
      .select(
        "id, secret_hash, pdf_storage_path, pdf_stored_at, clean_pdf_storage_path, expires_at, digital_purchased_at, pet_name, chapter_count",
      )
      .eq("id", draftId)
      .maybeSingle();

    if (error || !data) return null;
    row = data as DraftRow;
  } catch {
    return null;
  }
  if (!row.secret_hash || !secretsMatch(secret, row.secret_hash)) return null;
  // `pdf_stored_at` is set the moment a book is banked and is never cleared,
  // so it marks "this draft was a book" even after the files are gone. A
  // Video Memory working row has never had one.
  if (!row.pdf_stored_at) return null;

  const { purchased, expiresAt, expired, path } = decideAccess(row);

  let pdfUrl: string | null = null;
  if (!expired && path) {
    try {
      const { data: signed } = await supabase.storage
        .from(PREVIEW_BUCKET)
        .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
      pdfUrl = signed?.signedUrl ?? null;
    } catch {
      // Falls through to the "no longer available" view below.
      pdfUrl = null;
    }
  }

  return {
    draftId: row.id,
    petName: (row.pet_name ?? "").trim(),
    chapterCount: row.chapter_count,
    expiresAt,
    expired,
    purchased,
    pdfUrl,
  };
}

/**
 * Who may read what, decided purely from the stored row.
 *
 * Split out from the database call so the rules can be tested directly. The
 * reaped case in particular is easy to get wrong: the sweep clears the file
 * paths but keeps the timestamps, and treating a path-less row as "not a book"
 * sends an expired link to a redirect instead of an explanation.
 */
export function decideAccess(
  row: DraftRow,
  now: Date = new Date(),
): {
  purchased: boolean;
  expiresAt: Date | null;
  expired: boolean;
  path: string;
} {
  const purchased = Boolean(row.digital_purchased_at);
  const expiresAt = row.expires_at ? new Date(row.expires_at) : null;

  // Past its date, or already reaped. A purchase clears the deadline outright,
  // so a bought book can never land here.
  const reaped = !row.pdf_storage_path;
  const expired =
    !purchased &&
    (reaped || (expiresAt !== null && expiresAt.getTime() <= now.getTime()));

  // Buyers get the clean file; everyone else gets the watermarked one. Decided
  // from the database, never from a client hint.
  const path = purchased
    ? (row.clean_pdf_storage_path ?? draftPdfPath(row.id, "clean"))
    : (row.pdf_storage_path ?? "");

  return { purchased, expiresAt: purchased ? null : expiresAt, expired, path };
}
