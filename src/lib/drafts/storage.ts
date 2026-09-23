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
export function draftPdfPath(
  draftId: string,
  kind: "clean" | "preview",
): string {
  return `drafts/${draftId}/${kind}.pdf`;
}

/**
 * The shareable link for a free book.
 *
 * The draft secret rides in the query string. A v4 uuid is already hard to
 * guess, but ids leak — into referrer headers, analytics, support tickets —
 * and the secret is what the rest of the draft system already treats as the
 * actual credential. Carrying it here keeps one bar rather than two.
 */
export function bookUrl(draftId: string, secret: string): string {
  // In the browser the live origin is the truth; SITE_URL is the fallback for
  // server-rendered links (email), where there is no window to ask.
  const origin =
    typeof window === "undefined" ? SITE_URL : window.location.origin;
  return `${origin}/book/${draftId}?k=${encodeURIComponent(secret)}`;
}
