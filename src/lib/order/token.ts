import { createHmac, timingSafeEqual } from "node:crypto";

import { readEnv, requireEnv } from "@/lib/env";

/**
 * A credential for one order.
 *
 * Until now the order's uuid was the only thing standing between a stranger
 * and somebody else's order, and a uuid is an identifier, not a secret: it
 * travels in URLs, referrer headers, analytics payloads and support tickets.
 * Anyone who learned one could mint upload URLs for that order's print files,
 * rewrite what the book contains, and change the address it ships to.
 *
 * So every route that changes an order now wants this as well. It is derived
 * rather than stored — an HMAC of the order id under a server-only key — which
 * means no column, no migration, and nothing extra to keep in step. The server
 * can check it by recomputing it.
 *
 * It rides in the checkout URL next to the order id, the same way a draft's
 * secret rides in its book link. That is the bar the rest of the product
 * already sets, and it keeps a customer able to finish paying from a link they
 * mailed themselves or opened on their phone.
 */

/**
 * `ORDER_TOKEN_SECRET` when it is set. Otherwise the service-role key, which
 * is high entropy, present anywhere orders can exist at all, and already the
 * most sensitive thing this server holds. Rotating either invalidates tokens
 * for orders still mid-checkout, which is why it is worth setting the
 * dedicated one before the service key ever needs rotating.
 */
function signingKey(): string {
  const explicit = readEnv("ORDER_TOKEN_SECRET");
  if (explicit) return explicit;
  return requireEnv("SUPABASE_SERVICE_ROLE_KEY")[0];
}

export function mintOrderToken(orderId: string): string {
  return createHmac("sha256", signingKey())
    .update(`order:${orderId}`)
    .digest("hex");
}

export function orderTokenValid(
  orderId: string,
  provided: string | null | undefined,
): boolean {
  if (!provided) return false;

  // A server with no signing key cannot tell a good token from a bad one, and
  // the safe answer to that is no. Throwing instead would turn a
  // configuration gap into a 500 on a page whose job is to explain itself.
  let expected: Buffer;
  try {
    expected = Buffer.from(mintOrderToken(orderId), "hex");
  } catch (error) {
    console.error("[ourTailTales] Order tokens are not configured.", error);
    return false;
  }
  // A non-hex string yields a short buffer rather than throwing, so the length
  // check below is what rejects it.
  const got = Buffer.from(provided, "hex");
  if (got.length !== expected.length) return false;
  return timingSafeEqual(got, expected);
}

export function orderTokenFromRequest(request: Request): string | null {
  return request.headers.get("x-order-token")?.trim() || null;
}

/** 401 to return, or null when the caller holds this order's token. */
export function requireOrderToken(
  request: Request,
  orderId: string,
): Response | null {
  if (orderTokenValid(orderId, orderTokenFromRequest(request))) return null;
  // Deliberately the same answer an unknown order gets, so this cannot be used
  // to test whether an order id exists.
  return Response.json({ error: "Unknown order." }, { status: 404 });
}
