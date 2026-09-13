/**
 * Funnel analytics. Counts and configuration only — never photo content,
 * filenames, or coordinates.
 */

export type FunnelEvent =
  | "landing_view"
  | "album_selected"
  | "processing_complete"
  | "book_size_confirmed"
  | "story_generated"
  | "sample_email_submitted"
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

  if (process.env.NODE_ENV === "development") {
    console.debug(`[ourTailTales] ${event}`, props ?? {});
  }
}
