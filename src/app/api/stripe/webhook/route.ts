import type Stripe from "stripe";

import { requireEnv, routeError } from "@/lib/env";
import { markNeedsReview, submitPaidOrderToLulu } from "@/lib/order/submit-print";
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

  const revision = claimed.book_snapshot as FrozenBookRevision | null;
  const videos = revision ? videosEligibleForArchival(revision) : [];

  if (videos.length === 0) {
    if (!claimed.interior_path || !claimed.cover_path) {
      await markNeedsReview(orderId, "Print files were missing at payment time.");
      return;
    }
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

  await supabase
    .from("orders")
    .update({ fulfillment_stage: "pending_archive" })
    .eq("id", orderId);

  for (const video of videos) {
    await supabase.from("order_video_memories").upsert(
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
  }
}
