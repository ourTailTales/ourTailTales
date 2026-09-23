import { SITE_URL } from "@/lib/env";

/**
 * Storage layout and link shape for free preview books.
 *
 * Paths deliberately sit under a literal `drafts/` prefix. The `book-previews`
 * RLS policies grant a signed-in user their own objects by matching the first
 * path segment against their uid, and "drafts" can never be a uuid — so these
 * objects are unreachable by any end user's own credentials. They are served
 * only through short-lived signed URLs minted by the server, which is what
 * keeps an unpaid book from being lifted straight out of the bucket.
 */
export type DraftPdfKind =
  /**
   * Where the browser puts the bytes.
   *
   * The only path a client is ever handed a signed upload URL for, and the
   * only one it can therefore overwrite. Nothing is ever served from here.
   * Every file that IS served is written by the server from these bytes, after
   * it has checked them, which is what stops a client from replacing a file
   * the server has already decided is safe to serve unwatermarked.
   */
  | "incoming"
  /** The whole book, unwatermarked. What a buyer receives. */
  | "clean"
  /** The whole book, watermarked. What an account holder reads before buying. */
  | "preview"
  /** The free first ten pages. What the welcome email carries. */
  | "teaser";

export const DRAFT_PDF_KINDS: readonly DraftPdfKind[] = [
  "incoming",
  "clean",
  "preview",
  "teaser",
];

export function draftPdfPath(draftId: string, kind: DraftPdfKind): string {
  return `drafts/${draftId}/${kind}.pdf`;
}

/** Every file a draft can own, for the nightly sweep to remove. */
export function allDraftPdfPaths(draftId: string): string[] {
  return DRAFT_PDF_KINDS.map((kind) => draftPdfPath(draftId, kind));
}

/**
 * The shareable link for a free book.
 *
 * The draft secret rides in the query string. A v4 uuid is already hard to
 * guess, but ids leak — into referrer headers, analytics, support tickets —
 * and the secret is what the rest of the draft system already treats as the
 * actual credential. Carrying it here keeps one bar rather than two.
 */
/**
 * Where an emailed link sends someone to make their account.
 *
 * Carries the draft so the book they were just reading is what the new account
 * picks up. Clicking a link that only reached their own inbox is itself proof
 * they hold that address, which is why the account needs no second
 * confirmation step afterwards.
 */
export function claimUrl(draftId: string, secret: string): string {
  const origin =
    typeof window === "undefined" ? SITE_URL : window.location.origin;
  return `${origin}/claim/${draftId}?k=${encodeURIComponent(secret)}`;
}

export function bookUrl(draftId: string, secret: string): string {
  // In the browser the live origin is the truth; SITE_URL is the fallback for
  // server-rendered links (email), where there is no window to ask.
  const origin =
    typeof window === "undefined" ? SITE_URL : window.location.origin;
  return `${origin}/book/${draftId}?k=${encodeURIComponent(secret)}`;
}
