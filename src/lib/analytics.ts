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
  | "book_size_confirmed"
  | "story_generated"
  | "sample_email_submitted"
  | "teaser_email_sent"
  | "teaser_wall_reached"
  | "lead_captured"
  | "free_pdf_downloaded"
  | "free_pdf_stored"
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

export function identifyLead(email: string): void {
  if (!postHogConfigured()) return;
  posthog.identify(posthog.get_distinct_id(), { email });
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
