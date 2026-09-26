import posthog from "posthog-js";

/**
 * Funnel analytics. Counts and configuration only — never photo content,
 * filenames, or coordinates.
 */

export type FunnelEvent =
  | "landing_view"
  | "create_page_viewed"
  | "album_selected"
  | "album_processing_started"
  | "album_processing_completed"
  | "free_book_generation_started"
  | "free_book_generation_completed"
  | "free_book_generation_failed"
  | "free_book_saved"
  | "free_book_opened"
  | "auth_gate_viewed"
  | "processing_complete"
  | "book_size_chosen"
  | "book_size_confirmed"
  | "story_generated"
  | "book_created"
  | "sample_email_submitted"
  | "teaser_email_sent"
  | "teaser_wall_reached"
  | "book_design_changed"
  | "page_layout_changed"
  | "page_note_written"
  | "cover_style_changed"
  | "cover_style_locked_tapped"
  | "lead_captured"
  | "free_pdf_downloaded"
  | "free_pdf_stored"
  | "book_finished"
  | "video_memories_offer_viewed"
  | "checkout_started"
  | "payment_succeeded";

type Props = Record<string, string | number | boolean>;

declare global {
  interface Window {
    ourTailTalesEvents?: { event: FunnelEvent; props?: Props; at: number }[];
  }
}

export function track(event: FunnelEvent, props?: Props): void {
  if (typeof window === "undefined") return;

  window.ourTailTalesEvents ??= [];
  window.ourTailTalesEvents.push({ event, props, at: Date.now() });

  if (
    process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN &&
    process.env.NEXT_PUBLIC_POSTHOG_HOST
  ) {
    posthog.capture(event, props);
  }

  if (process.env.NODE_ENV === "development") {
    console.debug(`[ourTailTales] ${event}`, props ?? {});
  }
}

/**
 * Attaches an address to whoever this browser is, without identifying them.
 *
 * This used to call `identify` with the anonymous id itself, which marks the
 * person as identified under that id. PostHog then refuses to merge them into
 * the account they make later, so their book-making and their purchase ended
 * up as two different people and the conversion funnel never joined up.
 */
export function identifyLead(email: string): void {
  if (!postHogConfigured()) return;
  posthog.setPersonProperties({ email });
}

/**
 * Signed in or signed up: from here on this browser is the account, and
 * everything it did anonymously (the book it made, where it came from) is
 * merged into it. Guarded so each page load identifies once.
 */
export function identifyAccount(userId: string, email?: string | null): void {
  if (!postHogConfigured()) return;
  if (posthog.get_distinct_id() === userId) return;
  posthog.identify(userId, email ? { email } : undefined);
}

export function captureClientException(error: unknown): void {
  if (!postHogConfigured()) return;
  posthog.captureException(error);
}

function postHogConfigured(): boolean {
  return Boolean(
    typeof window !== "undefined" &&
      process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN &&
      process.env.NEXT_PUBLIC_POSTHOG_HOST,
  );
}
