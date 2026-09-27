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
  /** The whole book, unwatermarked. What a buyer receives. */
  | "clean"
  /** The whole book, watermarked. What an account holder reads before buying. */
  | "preview"
  /** The free first ten pages. What the welcome email carries. */
  | "teaser";

export const DRAFT_PDF_KINDS: readonly DraftPdfKind[] = [
  "clean",
  "preview",
  "teaser",
];

export function draftPdfPath(draftId: string, kind: DraftPdfKind): string {
  return `drafts/${draftId}/${kind}.pdf`;
}

/**
 * Where the browser puts the bytes ahead of a bank, kept separate per bank
 * kind rather than one shared slot.
 *
 * A teaser is banked automatically in the background; a full/clean bank is
 * user-triggered from a purchase. One shared staging path let a teaser
 * upload land in the middle of a full bank's own upload-then-finalize pair —
 * two tabs on one draft is the easy way there — and overwrite the bytes the
 * finalize step was about to read. Its own page-count guard only rejects an
 * upload of `TEASER_PAGE_COUNT` pages or fewer, so an 11-page teaser (its
 * cover, nine pages, and a "there is more" notice) cleared that guard and
 * was banked as the whole book. Separate slots make that byte-for-byte
 * collision impossible regardless of timing; the finalize step still
 * independently re-checks the page count against the declared kind before
 * writing anything a customer can read.
 */
export function draftIncomingPdfPath(
  draftId: string,
  bankKind: "teaser" | "full",
): string {
  return `drafts/${draftId}/incoming-${bankKind}.pdf`;
}

/** Every file a draft can own, for the nightly sweep to remove. */
export function allDraftPdfPaths(draftId: string): string[] {
  return [
    ...DRAFT_PDF_KINDS.map((kind) => draftPdfPath(draftId, kind)),
    draftIncomingPdfPath(draftId, "teaser"),
    draftIncomingPdfPath(draftId, "full"),
  ];
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
