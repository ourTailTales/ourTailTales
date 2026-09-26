import { stripeClient } from "@/lib/stripe";
import { supabaseAdmin, supabaseConfigured } from "@/lib/supabase/server";

/**
 * The client secret for an order's payment, if one has been set up.
 *
 * Read on the payment page rather than carried from the delivery page, which
 * is what lets payment be a page of its own: a reload, a back button, or the
 * link itself opens the same intent instead of starting a second one. Stripe
 * ids never leave the server — only the client secret does, which is what the
 * browser needs and what it already had.
 *
 * Only ever called after the order's token has been checked.
 */
export async function readPaymentClientSecret(
  orderId: string,
): Promise<string | null> {
  if (!supabaseConfigured()) return null;

  const { data } = await supabaseAdmin()
    .from("orders")
    .select("stripe_payment_intent_id")
    .eq("id", orderId)
    .maybeSingle();

  const intentId = data?.stripe_payment_intent_id;
  if (!intentId) return null;

  try {
    const intent = await stripeClient().paymentIntents.retrieve(intentId);
    // A payment already taken is not one to be taken again: the order page is
    // where that customer belongs, and the page above sends them there.
    if (intent.status === "succeeded" || intent.status === "canceled") return null;
    return intent.client_secret;
  } catch {
    // No Stripe key in this environment, or an intent Stripe no longer has.
    return null;
  }
}
