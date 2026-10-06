/**
 * The words a customer is shown when something fails.
 *
 * Our own routes answer with a sentence written for the customer, and that
 * sentence is passed on. What must not be passed on is what the browser or
 * our own plumbing says when the request never got an answer: "Failed to
 * fetch", "Load failed", "Request to /api/orders failed (504)". Those mean
 * nothing to the person reading them, so the fallback is shown instead.
 */
const TRANSPORT_PATTERNS = [
  /^failed to fetch$/i,
  /^load failed$/i,
  /^networkerror/i,
  /^network request failed$/i,
  /^request to \S+ failed/i,
  /^the operation was aborted/i,
  /^unexpected (token|end of)/i,
];

export function customerMessage(error: unknown, fallback: string): string {
  if (!(error instanceof Error)) return fallback;
  if (error instanceof TypeError) return fallback;
  const message = error.message.trim();
  if (!message) return fallback;
  if (TRANSPORT_PATTERNS.some((pattern) => pattern.test(message))) return fallback;
  return message;
}

/** Shown when a request did not get through at all. */
export const CONNECTION_FALLBACK =
  "We could not reach ourTailTales. Check your connection and try again.";
