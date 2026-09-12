import type Stripe from "stripe";

import { requireEnv, routeError } from "@/lib/env";
import { createPrintJob } from "@/lib/lulu/client";
import { stripeClient } from "@/lib/stripe";
import {
  STORAGE_BUCKET,
  supabaseAdmin,
} from "@/lib/supabase/server";
import type { ShippingAddress } from "@/types/order";

/**
 * The only place a Lulu print job is ever created.
 *
 * Fulfilment is deliberately webhook-driven: the browser never triggers it, so
 * a closed tab or a double-clicked button cannot produce two printed books.
 */

/** Lulu must be able to fetch the files while the job is validated. */
const DOWNLOAD_TTL_SECONDS = 60 * 60 * 24 * 7;

export async function POST(request: Request): Promise<Response> {
  try {
    const [webhookSecret] = requireEnv("STRIPE_WEBHOOK_SECRET");

    const signature = request.headers.get("stripe-signature");
    if (!signature) {
      return Response.json({ error: "Missing signature." }, { status: 400 });
    }

    // Signature verification needs the exact bytes Stripe signed.
    const rawBody = await request.text();

    let event: Stripe.Event;
    try {
      event = await stripeClient().webhooks.constructEventAsync(
        rawBody,
        signature,
        webhookSecret,
      );
    } catch (error) {
      console.error("[ourTailTales] Stripe signature rejected", error);
      return Response.json({ error: "Invalid signature." }, { status: 400 });
    }

    if (event.type === "payment_intent.succeeded") {
      await fulfill(event.data.object);
    } else if (event.type === "payment_intent.payment_failed") {
      console.warn(
        "[ourTailTales] Payment failed for order",
        event.data.object.metadata?.orderId,
      );
    }

    return Response.json({ received: true });
  } catch (error) {
    return routeError(error, "Webhook handling failed.");
  }
}

async function fulfill(paymentIntent: Stripe.PaymentIntent): Promise<void> {
  if (paymentIntent.status !== "succeeded") return;

  const orderId = paymentIntent.metadata?.orderId;
  if (!orderId) {
    console.error("[ourTailTales] PaymentIntent without orderId", paymentIntent.id);
    return;
  }

  const supabase = supabaseAdmin();

  /**
   * Claim the order with a conditional update. Only the caller whose update
   * matches a row proceeds, so retried or duplicated webhook deliveries cannot
   * each create a print job.
   */
  const { data: claimed, error: claimError } = await supabase
    .from("orders")
    .update({ status: "paid", paid_at: new Date().toISOString() })
    .eq("id", orderId)
    .eq("status", "pending_payment")
    .is("lulu_print_job_id", null)
    .select(
      "id, email, pet_name, chapter_count, total_pages, interior_path, cover_path",
    )
    .maybeSingle();

  if (claimError) throw new Error(claimError.message);
  if (!claimed) {
    // Already claimed, already printed, or cancelled. Nothing to do.
    return;
  }

  if (!claimed.interior_path || !claimed.cover_path) {
    await markNeedsReview(orderId, "Print files were missing at payment time.");
    return;
  }

  const { data: shipping, error: shippingError } = await supabase
    .from("order_shipping")
    .select("*")
    .eq("order_id", orderId)
    .maybeSingle();

  if (shippingError) throw new Error(shippingError.message);
  if (!shipping) {
    await markNeedsReview(orderId, "No shipping address was recorded.");
    return;
  }

  try {
    const [interiorUrl, coverUrl] = await Promise.all([
      signDownload(claimed.interior_path),
      signDownload(claimed.cover_path),
    ]);

    const printJob = await createPrintJob({
      orderId,
      title: claimed.pet_name
        ? `${claimed.pet_name} — ourTailTales`
        : "ourTailTales",
      pageCount: claimed.total_pages,
      interiorUrl,
      coverUrl,
      address: {
        name: shipping.name,
        phone: shipping.phone,
        street1: shipping.street1,
        street2: shipping.street2 ?? undefined,
        city: shipping.city,
        state: shipping.state,
        postcode: shipping.postcode,
        country: "US",
      } satisfies ShippingAddress,
      shippingLevel: shipping.shipping_level,
    });

    const { error: saveError } = await supabase
      .from("orders")
      .update({
        lulu_print_job_id: String(printJob.id),
        status: "submitted",
        submitted_at: new Date().toISOString(),
      })
      .eq("id", orderId);

    if (saveError) throw new Error(saveError.message);
  } catch (error) {
    // Payment succeeded, so never lose the order: flag it for a human.
    console.error("[ourTailTales] Lulu submission failed", orderId, error);
    await markNeedsReview(
      orderId,
      error instanceof Error ? error.message : "Lulu submission failed.",
    );
  }
}

async function signDownload(path: string): Promise<string> {
  const { data, error } = await supabaseAdmin()
    .storage.from(STORAGE_BUCKET)
    .createSignedUrl(path, DOWNLOAD_TTL_SECONDS);

  if (error || !data?.signedUrl) {
    throw new Error(error?.message ?? `Could not sign download for ${path}`);
  }
  return data.signedUrl;
}

async function markNeedsReview(orderId: string, reason: string): Promise<void> {
  await supabaseAdmin()
    .from("orders")
    .update({ status: "needs_review", review_reason: reason })
    .eq("id", orderId);
}
