/**
 * How long a free preview book has left.
 *
 * Kept as plain functions so the wording can be tested without rendering a
 * page, and rounded up: a book with six hours left has "1 day", not "0 days".
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

/**
 * Plain statement of fact, not a countdown clock. The brand rules rule out
 * manufactured urgency, so this says what happens and when, and stops there.
 */
export function expiryLabel(expiresAt: Date, now: Date = new Date()): string {
  const days = daysUntilExpiry(expiresAt, now);
  if (days === 0) return "Expires today";
  if (days === 1) return "Expires tomorrow";
  return `Expires in ${days} days`;
}

/**
 * The loud version, for the banner over a preview and the top of the teaser
 * PDF: "EXPIRES IN 5 DAYS". Asked for explicitly — this is the one place the
 * product shouts about the deadline, because a preview nobody saves is lost.
 */
export function expiryHeadline(expiresAt: Date, now: Date = new Date()): string {
  return expiryLabel(expiresAt, now).toUpperCase();
}

/** "October 24, 2026" — the absolute date, for a file that cannot count down. */
export function formatExpiryDate(expiresAt: Date): string {
  return expiresAt.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}
