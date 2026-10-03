/**
 * How long a free preview book is kept.
 *
 * Kept as plain functions so they can be tested without rendering a page.
 * Day counts round up: a book with six hours left has 1 day, not 0.
 */

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * How long a free preview is kept. Shared by the server, which stamps the
 * draft's `expires_at` when the teaser is banked, and the browser, which
 * prints the same deadline onto the teaser PDF before that upload has run.
 */
export const DRAFT_TTL_DAYS = 30;

/** When a preview banked now would expire. */
export function previewExpiryFrom(start: Date | number = Date.now()): Date {
  const expiresAt = new Date(start);
  expiresAt.setUTCDate(expiresAt.getUTCDate() + DRAFT_TTL_DAYS);
  return expiresAt;
}

export function daysUntilExpiry(expiresAt: Date, now: Date = new Date()): number {
  const remaining = expiresAt.getTime() - now.getTime();
  if (remaining <= 0) return 0;
  return Math.ceil(remaining / MS_PER_DAY);
}

/** "October 24, 2026": the absolute date, for a file that cannot count down. */
export function formatExpiryDate(expiresAt: Date): string {
  return expiresAt.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}
