/**
 * How long a free preview book has left.
 *
 * Kept as plain functions so the wording can be tested without rendering a
 * page, and rounded up: a book with six hours left has "1 day", not "0 days".
 */

const MS_PER_DAY = 24 * 60 * 60 * 1000;

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
