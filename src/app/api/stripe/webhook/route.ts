import type Stripe from "stripe";
import { freezePrintFiles } from "@/lib/order/freeze-print-files";

import { requireEnv, routeError } from "@/lib/env";
import { sendDigitalPurchaseEmail, sendOrderConfirmationEmail } from "@/lib/email/send";
import { bookUrl } from "@/lib/drafts/storage";
import { markNeedsReview, submitPaidOrderToLulu } from "@/lib/order/submit-print";
import {
  captureServerEvent,
  captureServerException,
} from "@/lib/posthog-server";
import { stripeClient } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabase/server";
import { videosEligibleForArchival } from "@/lib/archival/can-archive";
import type { FrozenBookRevision } from "@/types/video-memory";

/**
 * The only place payment confirmation is recorded.
 *
 * Fulfilment is webhook-driven. This handler returns quickly: it claims the
 * order and either submits a photo-only Lulu job or inserts durable archival
 * work. It never imports Turbo or transcodes video.
 */

export async function POST(request: Request): Promise<Response> {
  try {
    const [webhookSecret] = requireEnv("STRIPE_WEBHOOK_SECRET");

    const signature = request.headers.get("stripe-signature");
    if (!signature) {
      return Response.json({ error: "Missing signature." }, { status: 400 });
    }

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

    if (event.type === "checkout.session.completed") {
      await grantDigitalAccess(event.data.object);
    } else if (event.type === "payment_intent.succeeded") {
      await fulfill(event.data.object);
    } else if (event.type === "payment_intent.payment_failed") {
      const paymentIntent = event.data.object;
      const orderId = paymentIntent.metadata?.orderId;
      console.warn("[ourTailTales] Payment failed for order", orderId);
      await captureServerEvent(
        paymentIntent.metadata?.posthogDistinctId || orderId || "stripe_webhook",
        "payment_failed",
        {
          amount: paymentIntent.amount / 100,
          currency: paymentIntent.currency,
          has_order: Boolean(orderId),
        },
      );
    }

    return Response.json({ received: true });
  } catch (error) {
    await captureServerException(error, "stripe_webhook");
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

  const { data: claimed, error: claimError } = await supabase
    .from("orders")
    .update({ status: "paid", paid_at: new Date().toISOString() })
    .eq("id", orderId)
    .eq("status", "pending_payment")
    .is("lulu_print_job_id", null)
    .select(
      "id, archival_consent_at, book_snapshot, selected_video_count, interior_path, cover_path, frozen_interior_path",
    )
    .maybeSingle();

  if (claimError) throw new Error(claimError.message);
  if (!claimed) return;

  // Claiming the row is what makes this run once, so the confirmation cannot
  // be duplicated by a webhook retry. Not awaited as a precondition of
  // fulfilment: a mail outage must never stop a paid book reaching the printer.
  void confirmByEmail(orderId);

  await captureServerEvent(
    paymentIntent.metadata?.posthogDistinctId || orderId,
    "payment_completed",
    {
      amount: paymentIntent.amount / 100,
      currency: paymentIntent.currency,
      video_memory_count: Number(claimed.selected_video_count ?? 0),
    },
  );

  // Before anything else reads them. The signed upload URLs the customer used
  // are still live, so from here on we print from a copy they cannot reach.
  let frozen = false;
  try {
    frozen = await freezePrintFiles(orderId);
  } catch (error) {
    console.error("[ourTailTales] Could not freeze print files", orderId, error);
  }
  if (!frozen) {
    await markNeedsReview(orderId, "Print files were missing at payment time.");
    return;
  }

  const revision = claimed.book_snapshot as FrozenBookRevision | null;
  const videos = revision ? videosEligibleForArchival(revision) : [];

  if (videos.length === 0) {
    try {
      await submitPaidOrderToLulu(orderId);
    } catch (error) {
      console.error("[ourTailTales] Lulu submission failed", orderId, error);
      await markNeedsReview(
        orderId,
        error instanceof Error ? error.message : "Lulu submission failed.",
      );
    }
    return;
  }

  if (!claimed.archival_consent_at) {
    await markNeedsReview(orderId, "Video Memory consent was missing.");
    return;
  }

  // The work first, the flag that says the work exists second.
  //
  // The other way round is how an order ends up paid, marked as awaiting
  // archival, and carrying no archival work at all: supabase-js returns its
  // errors rather than throwing them, so a failed insert here used to pass
  // silently, and a webhook retry could not put it right because the claim
  // above had already moved the row out of `pending_payment`. Nothing sweeps
  // that state. The money is taken and no book is ever made.
  for (const video of videos) {
    const { error: queueError } = await supabase
      .from("order_video_memories")
      .upsert(
        {
          order_id: orderId,
          video_asset_id: video.videoAssetId,
          processed_path: video.processedPath,
          processed_bytes: video.processedBytes,
          content_sha256: video.contentSha256,
          duration_ms: video.durationMs,
          width: video.width,
          height: video.height,
          status: "pending",
        },
        { onConflict: "order_id,video_asset_id" },
      );

    if (queueError) {
      console.error("[ourTailTales] Could not queue a Video Memory", orderId, queueError);
      await markNeedsReview(orderId, "Video Memory work could not be queued.");
      return;
    }
  }

  const { error: stageError } = await supabase
    .from("orders")
    .update({ fulfillment_stage: "pending_archive" })
    .eq("id", orderId);

  if (stageError) {
    console.error("[ourTailTales] Could not stage for archival", orderId, stageError);
    await markNeedsReview(orderId, "The order could not be staged for archival.");
  }
}

/** Best-effort order confirmation. Never throws into the webhook path. */
async function confirmByEmail(orderId: string): Promise<void> {
  try {
    const { data: order } = await supabaseAdmin()
      .from("orders")
      .select("id, email, pet_name, book_price, shipping_price")
      .eq("id", orderId)
      .maybeSingle();

    if (!order?.email) return;

    const total =
      Number(order.book_price ?? 0) + Number(order.shipping_price ?? 0);

    await sendOrderConfirmationEmail({
      to: order.email,
      petName: order.pet_name ?? "",
      orderId: order.id,
      total: new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
      }).format(total),
    });
  } catch (error) {
    console.error("[ourTailTales] Order confirmation email failed", orderId, error);
  }
}

/**
 * Releases the clean PDF after a $4.99 digital purchase.
 *
 * This is the only place that grant happens. Clearing `expires_at` is what
 * makes the book permanent, so the Phase 4 sweep will no longer touch it.
 */
async function grantDigitalAccess(
  session: Stripe.Checkout.Session,
): Promise<void> {
  if (session.payment_status !== "paid") return;

  const draftId = session.metadata?.draftId;
  if (!draftId) return;

  const supabase = supabaseAdmin();

  // Conditional on not already being purchased, so a redelivered webhook
  // cannot re-grant or send a second confirmation.
  const { data: claimed, error } = await supabase
    .from("book_drafts")
    .update({
      digital_purchased_at: new Date().toISOString(),
      watermarked: false,
      expires_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", draftId)
    .is("digital_purchased_at", null)
    .select("id, pet_name")
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!claimed) return;

  await captureServerEvent(
    session.metadata?.posthogDistinctId || draftId,
    "digital_purchase_completed",
    { amount: (session.amount_total ?? 0) / 100 },
  );

  const email = session.customer_details?.email ?? session.customer_email;
  const secret = session.metadata?.draftSecret;
  if (!email || !secret) return;

  try {
    await sendDigitalPurchaseEmail({
      to: email,
      petName: claimed.pet_name ?? "",
      bookUrl: bookUrl(draftId, secret),
    });
  } catch (sendError) {
    console.error("[ourTailTales] Digital purchase email failed", draftId, sendError);
  }
}
