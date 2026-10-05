import { clampCopies, copiesTotal } from "@/lib/pricing";

/** The stored columns an order's total is made of. */
export type PricedOrder = {
  /** The price of one copy, as stored when the order was opened. */
  book_price: number | string | null;
  quantity: number | null;
  video_memory_total_cents: number | null;
  /** Null until delivery has been chosen, and again once it is unlocked. */
  shipping_price: number | string | null;
  /**
   * Sales tax, locked with the shipping price. Null or absent means none,
   * which is every order placed before tax was collected.
   */
  tax_price?: number | string | null;
};

/**
 * What an order should cost, in minor units, from what is stored on it.
 *
 * The one sum both the charge and every check of the charge are made from: the
 * payment webhook compares it with what Stripe received, and the operator's
 * resubmit route does the same before it lets a held order print. Two copies
 * of this arithmetic is how a charge and its check drift apart.
 *
 * Null when the shipping price is not locked, which means there is no amount
 * this order can be said to cost yet.
 */
export function expectedOrderAmount(order: PricedOrder): number | null {
  if (order.shipping_price === null || order.shipping_price === undefined) {
    return null;
  }
  const unit = Number(order.book_price);
  const shipping = Number(order.shipping_price);
  if (!Number.isFinite(unit) || !Number.isFinite(shipping)) return null;
  const tax = Number(order.tax_price ?? 0);
  if (!Number.isFinite(tax) || tax < 0) return null;

  const total =
    copiesTotal(unit, clampCopies(order.quantity)) +
    Number(order.video_memory_total_cents ?? 0) / 100 +
    shipping +
    tax;
  return Math.round(total * 100);
}

/**
 * The hold placed on an order whose payment does not match its price.
 *
 * It is the one hold that happens before the customer has been sent a
 * confirmation, so the resubmit route reads it to know that mail is still
 * owed. Printed to nobody: the order page has its own words for a held order.
 */
export const AMOUNT_MISMATCH_REASON =
  "The amount paid does not match this order. It is being checked by hand before printing.";
