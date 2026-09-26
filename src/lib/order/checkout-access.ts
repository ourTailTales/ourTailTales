import { readOrder, type OrderView } from "@/lib/order/read";
import { readOrderShipping, type SavedShipping } from "@/lib/order/shipping";
import { orderTokenValid } from "@/lib/order/token";
import { supabaseConfigured } from "@/lib/supabase/server";

export type CheckoutStep = "address" | "shipping" | "payment";

export type CheckoutAccess =
  | { ok: true; order: OrderView; token: string; shipping: SavedShipping | null }
  | { ok: false; reason: CheckoutRefusal };

export type CheckoutRefusal =
  | "not_configured"
  | "unknown_order"
  | "already_ordered"
  | "memories_preparing"
  | "print_files_uploading";

/**
 * Whether this link may see this checkout, asked once for every step.
 *
 * The id says which order and the token says it is yours; both are checked on
 * the page as well as on the routes, so a link without one lands on an
 * explanation rather than on a form whose every button would be refused. The
 * steps are separate pages now, and each asks this for itself: a link straight
 * to the payment page is exactly as unwelcome as a link to the first one.
 */
export async function checkoutAccess(
  params: Record<string, string | string[] | undefined>,
): Promise<CheckoutAccess> {
  if (!supabaseConfigured()) return { ok: false, reason: "not_configured" };

  const orderId = typeof params.order === "string" ? params.order : null;
  const token = typeof params.t === "string" ? params.t : null;
  if (!orderId || !token || !orderTokenValid(orderId, token)) {
    return { ok: false, reason: "unknown_order" };
  }

  const order = await readOrder(orderId);
  if (!order) return { ok: false, reason: "unknown_order" };
  if (order.status !== "pending_payment") {
    return { ok: false, reason: "already_ordered" };
  }
  if (order.hasVideoMemories && !order.hasFrozenRevision) {
    return { ok: false, reason: "memories_preparing" };
  }
  if (!order.hasVideoMemories && !order.hasPrintFiles) {
    return { ok: false, reason: "print_files_uploading" };
  }

  return {
    ok: true,
    order,
    token,
    shipping: await readOrderShipping(order.id),
  };
}

/** Keeps the order and its token on every link between the steps. */
export function stepHref(step: CheckoutStep, orderId: string, token: string): string {
  return `/checkout/${step}?order=${orderId}&t=${encodeURIComponent(token)}`;
}

/**
 * The furthest step this order has earned, for a link that names none.
 *
 * A confirmation link, a reload of `/checkout`, or the back button out of the
 * order page should return somebody to where they had got to rather than to
 * the beginning of a form they have already filled in.
 */
export function furthestStep(
  shipping: SavedShipping | null,
  hasPaymentIntent: boolean,
): CheckoutStep {
  if (hasPaymentIntent && shipping?.level) return "payment";
  if (shipping) return "shipping";
  return "address";
}
