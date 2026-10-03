/**
 * Remembers, in this browser, that a hardcover's PDF copy still has to be
 * saved.
 *
 * The clean PDF that comes with a hardcover is rendered in the customer's
 * browser during checkout. If that is cut short, by a closed tab, a reload or
 * a bank's redirect, the order is paid and the file never arrives, and the
 * only place it can be made is this browser, which holds the photographs.
 * This note is what lets the editor finish the job the next time the book is
 * opened here. Keyed by the address the book was made under, the same way the
 * local draft is.
 *
 * Storage can be unavailable (private browsing). Every call fails quietly:
 * the worst case is the customer emailing us for the file, which is what the
 * order page tells them to do.
 */
const PREFIX = "ott.pdfOwed:";

function key(emailKey: string): string {
  return `${PREFIX}${emailKey.trim().toLowerCase() || "anon"}`;
}

export function markPdfOwed(emailKey: string): void {
  try {
    window.localStorage.setItem(key(emailKey), new Date().toISOString());
  } catch {
    // Nothing to do.
  }
}

export function clearPdfOwed(emailKey: string): void {
  try {
    window.localStorage.removeItem(key(emailKey));
  } catch {
    // Nothing to do.
  }
}

export function pdfIsOwed(emailKey: string): boolean {
  try {
    return window.localStorage.getItem(key(emailKey)) !== null;
  } catch {
    return false;
  }
}
