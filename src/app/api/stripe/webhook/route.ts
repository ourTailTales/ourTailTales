import type Stripe from "stripe";
import { freezePrintFiles } from "@/lib/order/freeze-print-files";

import { requireEnv, routeError } from "@/lib/env";
import { sendDigitalPurchaseEmail } from "@/lib/email/send";
import { previewExpiryFrom } from "@/lib/drafts/expiry";
import { bookUrl } from "@/lib/drafts/storage";
import {
  DRAFT_PAYMENT_INTENT_COLUMN,
  confirmByEmail,
  includeDigitalCopy,
  quietly,
} from "@/lib/order/after-payment";
import { AMOUNT_MISMATCH_REASON, expectedOrderAmount } from "@/lib/order/amount";
import {
  PRINT_FILE_MISMATCH_REASON,
  checkFrozenInterior,
} from "@/lib/order/print-file-check";
import { markNeedsReview, submitPaidOrderToLulu } from "@/lib/order/submit-print";
import { shippingFingerprint } from "@/lib/order/shipping-fingerprint";
import {
  recordSalesTax,
  reversePartialSalesTax,
  reverseSalesTax,
} from "@/lib/order/tax";
import { alertOps } from "@/lib/ops/alert";
import {
  captureServerEvent,
  captureServerException,
} from "@/lib/posthog-server";
import { stripeClient } from "@/lib/stripe";
import { isMissingColumnError } from "@/lib/supabase/missing-column";
import { supabaseAdmin } from "@/lib/supabase/server";
import { videosEligibleForArchival } from "@/lib/archival/can-archive";
import type { FrozenBookRevision } from "@/types/video-memory";

/**
 * The only place payment confirmation is recorded.
 *
 * Fulfilment is webhook-driven. This handler returns quickly: it claims the
 * order and either submits a photo-only Lulu job or inserts durable archival
 * work. It never imports Turbo or transcodes video.
 *
 * The order of work inside `fulfill` is deliberate: claim, check the amount,
 * freeze the files, send to print. The email, the PDF unlock and the analytics
 * come after, each on a short leash, because they talk to other people's
 * servers and a slow one must not use up the seconds the print job needs.
 */

// Freezing copies the print files and submission talks to the printer. The
// platform default is too short for both on a slow day, and a timeout after
// the claim leaves an order paid with no print job.
export const maxDuration = 60;

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
    } else if (event.type === "charge.refunded") {
      const charge = event.data.object;
      // Fires for a partial refund too. Refunding shipping as a goodwill
      // gesture must not cancel the book the customer is still waiting for.
      const whole =
        charge.refunded === true ||
        (charge.amount > 0 && charge.amount_refunded >= charge.amount);
      if (whole) {
        await moneyGoingBack(charge.payment_intent, "refunded");
      } else {
        // The tax on the part that went back comes off Stripe's records. What
        // went back this time is the change in the running total.
        const before = Number(
          (event.data.previous_attributes as { amount_refunded?: number } | undefined)
            ?.amount_refunded ?? 0,
        );
        await partialRefundTax(
          charge.payment_intent,
          charge.amount_refunded - before,
          charge.amount_refunded,
        );
        await alertOps("An order was partly refunded and left running", {
          charge: charge.id,
          refunded: charge.amount_refunded,
          of: charge.amount,
        });
      }
    } else if (event.type === "charge.dispute.created") {
      await moneyGoingBack(event.data.object.payment_intent, "disputed");
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

  // Read before the claim only to tell a redelivery from a second payment
  // and an unknown order from a known one. The price is NOT taken from here:
  // see the claim below.
  const { data: priced, error: pricedError } = await supabase
    .from("orders")
    .select("status, stripe_payment_intent_id")
    .eq("id", orderId)
    .maybeSingle();
  if (pricedError) throw new Error(pricedError.message);
  if (!priced) {
    await alertOps("A payment succeeded for an order that does not exist", {
      order: orderId,
      paymentIntent: paymentIntent.id,
    });
    return;
  }

  const { data: claimed, error: claimError } = await supabase
    .from("orders")
    .update({ status: "paid", paid_at: new Date().toISOString() })
    .eq("id", orderId)
    .eq("status", "pending_payment")
    .is("lulu_print_job_id", null)
    // What the order costs comes back from the claim itself. The amount on
    // the intent was fixed when delivery was chosen; the delivery speed, the
    // address and the number of copies can all be changed while the order is
    // unpaid. Read in a separate statement before the claim, a change landing
    // between the two was checked against the old price and printed as
    // changed. The claim ends the order's unpaid state, so nothing can move
    // these columns after the row this returns.
    .select(
      "id, archival_consent_at, book_snapshot, selected_video_count, interior_path, cover_path, frozen_interior_path, stripe_payment_intent_id, book_price, quantity, shipping_price, tax_price, tax_calculation_id, video_memory_total_cents, draft_id, chapter_count",
    )
    .maybeSingle();

  if (claimError) throw new Error(claimError.message);
  if (!claimed) {
    // A redelivery of the payment already handled is the ordinary case. A
    // different payment on an order already paid for is a second charge.
    if (
      priced.stripe_payment_intent_id &&
      priced.stripe_payment_intent_id !== paymentIntent.id
    ) {
      await alertOps("An order may have been paid for twice", {
        order: orderId,
        paymentIntent: paymentIntent.id,
        recorded: priced.stripe_payment_intent_id,
        note: "Refund one of the two payments in Stripe.",
      });
    }
    return;
  }

  // The same sum the charge was made from, over the same stored columns.
  const expected = expectedOrderAmount(claimed);
  const paid = paymentIntent.amount_received ?? paymentIntent.amount;
  if (
    expected === null ||
    paid !== expected ||
    claimed.stripe_payment_intent_id !== paymentIntent.id
  ) {
    // No confirmation is sent for this hold. The resubmit route reads this
    // reason to know the customer is still owed one.
    await markNeedsReview(orderId, AMOUNT_MISMATCH_REASON);
    await alertOps("A paid order does not match its price", {
      order: orderId,
      paymentIntent: paymentIntent.id,
      paidCents: paid,
      expectedCents: expected ?? "price was unlocked after the amount was fixed",
      note: "Delivery details or copies changed after the amount was set. Charge or refund the difference, then POST /api/admin/orders/<id>/resubmit with the cron secret (add ?force=amount once the difference is settled).",
    });
    return;
  }

  // The amount matches. Now the details it was quoted on: the address, speed
  // and copies the print job is about to be made from must be the ones this
  // payment was priced for. A payment set up before this digest existed
  // carries none and is let through on the amount alone.
  const pricedFor = paymentIntent.metadata?.shippingFingerprint;
  if (pricedFor) {
    const { data: shipping, error: shippingError } = await supabase
      .from("order_shipping")
      .select("name, phone, street1, street2, city, state, postcode, country, shipping_level")
      .eq("order_id", orderId)
      .maybeSingle();
    if (shippingError) throw new Error(shippingError.message);
    const stored = shipping
      ? shippingFingerprint({
          address: shipping,
          level: shipping.shipping_level ?? "",
          quantity: claimed.quantity,
        })
      : null;
    if (stored !== pricedFor) {
      await markNeedsReview(orderId, AMOUNT_MISMATCH_REASON);
      await alertOps("A paid order's delivery details do not match what was priced", {
        order: orderId,
        paymentIntent: paymentIntent.id,
        note: "The address, delivery speed or copies on the order are not the ones the payment was quoted for. Check the order, settle any difference, then POST /api/admin/orders/<id>/resubmit with the cron secret (add ?force=amount once settled).",
      });
      return;
    }
  }

  // The print job first. Everything after it is a courtesy by comparison, and
  // it used to run ahead of this: a slow mail or analytics call could use up
  // the function's time and leave a paid order with no print job.
  let printError: unknown = null;
  try {
    await sendToPrint(orderId, claimed);
  } catch (error) {
    // Kept until the customer has been told their payment landed. Rethrown
    // below so Stripe's log shows the failure; the claim above means a retry
    // cannot print or send anything twice.
    printError = error;
    console.error("[ourTailTales] Fulfilment failed after payment", orderId, error);
  }

  // Claiming the row is what makes this run once, so the confirmation cannot
  // be duplicated by a webhook retry. Awaited, because a function that has
  // answered may be frozen before an unawaited send leaves, but each step is
  // cut off rather than waited on for ever.
  const distinctId = paymentIntent.metadata?.posthogDistinctId || orderId;
  // The tax the customer has just paid, put on Stripe's tax records. After
  // the print job, because it is bookkeeping and the book is not.
  if (claimed.tax_calculation_id) {
    await quietly("Sales tax record", async () => {
      const transactionId = await recordSalesTax({
        orderId,
        calculationId: claimed.tax_calculation_id,
      });
      if (!transactionId) return;
      const { error } = await supabase
        .from("orders")
        .update({ tax_transaction_id: transactionId })
        .eq("id", orderId);
      if (error) throw new Error(error.message);
    });
  }
  await quietly("Order confirmation email", () => confirmByEmail(orderId), 10_000);
  // The clean PDF comes with the hardcover.
  await quietly("Included PDF unlock", () =>
    includeDigitalCopy({
      draftId: claimed.draft_id,
      paymentIntentId: paymentIntent.id,
      chapterCount: claimed.chapter_count,
    }),
  );
  await quietly(
    "payment_completed capture",
    () =>
      captureServerEvent(distinctId, "payment_completed", {
        amount: paymentIntent.amount / 100,
        currency: paymentIntent.currency,
        video_memory_count: Number(claimed.selected_video_count ?? 0),
      }),
    4_000,
  );
  // The one conversion event, whatever was bought, so a single funnel
  // (book_created → order_completed) covers both products.
  await quietly(
    "order_completed capture",
    () =>
      captureServerEvent(distinctId, "order_completed", {
        product: "hardcover",
        revenue: paymentIntent.amount / 100,
        currency: paymentIntent.currency,
        order_id: orderId,
      }),
    4_000,
  );

  if (printError) throw printError;
}

/**
 * Freezes a claimed order's files and sends it to print, or queues its Video
 * Memories for archival. Every expected failure ends as a hold on the order.
 */
async function sendToPrint(
  orderId: string,
  claimed: {
    archival_consent_at: string | null;
    book_snapshot: unknown;
  },
): Promise<void> {
  const supabase = supabaseAdmin();

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

  // The frozen file, counted. With Video Memories the interior is rebuilt by
  // our own server before it prints, so only the browser's file is checked.
  if (videos.length === 0) {
    let verdict: Awaited<ReturnType<typeof checkFrozenInterior>>;
    try {
      verdict = await checkFrozenInterior(orderId);
    } catch (error) {
      console.error("[ourTailTales] Could not check the print file", orderId, error);
      verdict = { ok: false, pages: null, detail: "The print file could not be checked." };
    }
    if (!verdict.ok) {
      await markNeedsReview(orderId, PRINT_FILE_MISMATCH_REASON);
      await alertOps("A paid order's print file does not match the order", {
        order: orderId,
        detail: verdict.detail,
        note: "Look at the interior file. If it is right, POST /api/admin/orders/<id>/resubmit with the cron secret to print it. If not, refund the order.",
      });
      return;
    }
  }

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

/** Adjusts the recorded sales tax for a partial refund. Never throws. */
async function partialRefundTax(
  paymentIntent: string | { id: string } | null | undefined,
  refundedCents: number,
  refundedToDateCents: number,
): Promise<void> {
  const paymentIntentId =
    typeof paymentIntent === "string" ? paymentIntent : paymentIntent?.id;
  if (!paymentIntentId || refundedCents <= 0) return;
  try {
    const { data: order } = await supabaseAdmin()
      .from("orders")
      .select("id, tax_transaction_id")
      .eq("stripe_payment_intent_id", paymentIntentId)
      .maybeSingle();
    if (!order?.tax_transaction_id) return;
    await reversePartialSalesTax({
      orderId: order.id,
      transactionId: order.tax_transaction_id,
      refundedCents,
      refundedToDateCents,
    });
  } catch (error) {
    console.error("[ourTailTales] Could not adjust tax for a partial refund", error);
  }
}

/**
 * A refund or a dispute stops the book.
 *
 * Neither event was handled at all, so a refunded order carried on to the
 * printer and shipped: the money went back and the hardcover went out. An
 * order that has not reached Lulu yet is simply cancelled. One that has is
 * beyond our reach — the press does not un-print — so it is flagged and a
 * person is told, because there may still be time to cancel it at Lulu.
 */
async function moneyGoingBack(
  paymentIntent: string | { id: string } | null | undefined,
  kind: "refunded" | "disputed",
): Promise<void> {
  const paymentIntentId =
    typeof paymentIntent === "string" ? paymentIntent : paymentIntent?.id;
  if (!paymentIntentId) return;

  const supabase = supabaseAdmin();
  const { data: order, error } = await supabase
    .from("orders")
    .select("id, status, lulu_print_job_id, tax_transaction_id")
    .eq("stripe_payment_intent_id", paymentIntentId)
    .maybeSingle();

  if (error) throw new Error(error.message);

  if (!order) {
    if (await revokeDigitalAccess(paymentIntentId, kind)) return;

    // Matched neither a hardcover order nor a digital purchase. Worth saying
    // out loud rather than passing over in silence.
    await alertOps(`A ${kind} payment matched no order`, {
      paymentIntent: paymentIntentId,
      kind,
    });
    return;
  }

  // The tax goes back with the money, whatever state the book is in. A
  // dispute is not a refund until it is lost, so only a refund reverses it.
  if (kind === "refunded") {
    await reverseSalesTax({
      orderId: order.id,
      transactionId: order.tax_transaction_id,
    });
  }

  // A book already in the post is not a book we can stop, and overwriting a
  // shipped order's status would take its tracking off the customer's page
  // for no benefit.
  if (order.status === "shipped" || order.status === "delivered") {
    // The book cannot be taken back. The PDF that came with it can.
    await takeBackIncludedPdf(order.id, paymentIntentId, kind);
    await alertOps(`A ${kind} payment on an order that already shipped`, {
      order: order.id,
      status: order.status,
      note: "The order's status was left alone. The included PDF was locked again.",
    });
    return;
  }

  if (order.lulu_print_job_id) {
    // `review_reason` is printed to the customer verbatim on their order
    // page, so it says what it means to them. What to do about it goes to
    // the person who can do it.
    await markNeedsReview(
      order.id,
      "This order is on hold while we sort out the payment. Nothing further will be printed until we do.",
    );
    await takeBackIncludedPdf(order.id, paymentIntentId, kind);
    await alertOps(`An order was ${kind} after it went to the printer`, {
      order: order.id,
      printJob: order.lulu_print_job_id,
      note: "Cancel the job at Lulu if it has not shipped.",
    });
    return;
  }

  const { error: cancelError } = await supabase
    .from("orders")
    .update({
      status: "canceled",
      review_reason:
        kind === "refunded"
          ? "This order was refunded."
          : "This order is on hold while the payment is disputed.",
    })
    .eq("id", order.id)
    .not("status", "in", "(shipped,delivered,canceled)");

  // The money has gone back and the book has not been stopped. Said out loud,
  // then thrown so Stripe delivers the event again.
  if (cancelError) {
    await alertOps(`A ${kind} order could NOT be cancelled`, {
      order: order.id,
      paymentIntent: paymentIntentId,
      error: cancelError.message,
      note: "Stop this order by hand before it reaches the printer.",
    });
    throw new Error(cancelError.message);
  }

  await takeBackIncludedPdf(order.id, paymentIntentId, kind);

  await alertOps(`An order was ${kind}`, {
    order: order.id,
    previousStatus: order.status,
  });
}

/**
 * The PDF that came with a hardcover goes back with the money.
 *
 * Two steps. The draft this payment unlocked is locked again; that is quiet
 * when the payment unlocked nothing, and it leaves alone a PDF the customer
 * bought separately, because that one is recorded against its own payment.
 * Then the order lets go of the draft, which is what stops the order page
 * unlocking it afresh the next time it is opened. Never throws: the refund
 * itself has already been handled by the time this runs.
 */
async function takeBackIncludedPdf(
  orderId: string,
  paymentIntentId: string,
  kind: "refunded" | "disputed",
): Promise<void> {
  try {
    await revokeDigitalAccess(paymentIntentId, kind);
    const { error } = await supabaseAdmin()
      .from("orders")
      .update({ draft_id: null })
      .eq("id", orderId);
    if (error) throw new Error(error.message);
  } catch (error) {
    console.error("[ourTailTales] Could not take back the included PDF", orderId, error);
  }
}

const PAYMENT_INTENT_COLUMN = DRAFT_PAYMENT_INTENT_COLUMN;

/** The database is missing supabase/migrations/20260927200000_draft_refund_tracking.sql. */
async function alertMigrationPending(
  draftId?: string,
  paymentIntentId?: string | null,
): Promise<void> {
  await alertOps(`book_drafts.${PAYMENT_INTENT_COLUMN} is missing`, {
    draft: draftId,
    paymentIntent: paymentIntentId,
    note: "Apply supabase/migrations/20260927200000_draft_refund_tracking.sql. Until then, digital purchases are granted but a refund or dispute cannot revoke them.",
  });
}

/**
 * The digital-purchase half of a refund or dispute.
 *
 * The $4.99 PDF has no `orders` row to match — it lives entirely on
 * `book_drafts` — so before this it was never handled at all: refunding or
 * disputing that charge took the money back and left the buyer permanently
 * holding the clean file anyway. Matched by the PaymentIntent
 * `grantDigitalAccess` recorded at purchase time. Returns whether a draft was
 * found, so the caller only alerts on a payment that matched neither an
 * order nor a draft.
 */
async function revokeDigitalAccess(
  paymentIntentId: string,
  kind: "refunded" | "disputed",
): Promise<boolean> {
  const supabase = supabaseAdmin();
  const now = new Date();

  const { data: draft, error } = await supabase
    .from("book_drafts")
    .update({
      digital_purchased_at: null,
      digital_stripe_payment_intent_id: null,
      watermarked: true,
      // A fresh window rather than an immediate cutoff: the nightly sweep
      // already only reaps drafts whose `expires_at` has passed, so this
      // just puts the draft back on that same clock instead of deleting its
      // files out from under someone mid-dispute.
      expires_at: previewExpiryFrom(now).toISOString(),
      updated_at: now.toISOString(),
    })
    .eq("digital_stripe_payment_intent_id", paymentIntentId)
    .select("id")
    .maybeSingle();

  // Without the column no purchase was ever linked to its payment, so there
  // is nothing to match. The caller alerts on the unmatched payment.
  if (isMissingColumnError(error, PAYMENT_INTENT_COLUMN)) {
    await alertMigrationPending();
    return false;
  }
  if (error) throw new Error(error.message);
  if (!draft) return false;

  await alertOps(`A digital PDF purchase was ${kind}`, {
    draft: draft.id,
    paymentIntent: paymentIntentId,
    note: "Access to the clean PDF has been revoked.",
  });
  return true;
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

  // So a later refund or dispute — matched by this same id — has something
  // to revoke. Without it, a refunded digital purchase would keep its buyer's
  // access forever: there would be nothing to look the draft up by.
  const paymentIntentId =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : (session.payment_intent?.id ?? null);

  // The length the session was priced for. A session opened for a short book
  // could otherwise be paid after a longer one was saved onto the same draft.
  // Sessions opened before this was recorded carry none and are not limited.
  const paidChapters = Math.floor(Number(session.metadata?.chapterCount));
  const limited = Number.isFinite(paidChapters) && paidChapters > 0;

  // Conditional on not already being purchased, so a redelivered webhook
  // cannot re-grant or send a second confirmation.
  const claim = (withPaymentIntent: boolean) => {
    const query = supabase
      .from("book_drafts")
      .update({
        digital_purchased_at: new Date().toISOString(),
        ...(withPaymentIntent
          ? { [PAYMENT_INTENT_COLUMN]: paymentIntentId }
          : {}),
        watermarked: false,
        expires_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", draftId)
      .is("digital_purchased_at", null);
    return (
      limited
        ? query.or(`chapter_count.is.null,chapter_count.lte.${paidChapters}`)
        : query
    )
      .select("id, pet_name")
      .maybeSingle();
  };

  let { data: claimed, error } = await claim(true);

  // The buyer has paid, so a database that is behind on migrations must not
  // stop the grant. PostgREST rejects the whole update before it runs, so the
  // retry is still the first and only write. The cost is that this purchase
  // has no link for a later refund to match.
  if (isMissingColumnError(error, PAYMENT_INTENT_COLUMN)) {
    await alertMigrationPending(draftId, paymentIntentId);
    ({ data: claimed, error } = await claim(false));
  }

  if (error) throw new Error(error.message);
  if (!claimed) {
    // Either a redelivery of a purchase already granted, which is fine, or a
    // paid session whose book has grown since. The second has taken money and
    // released nothing, so a person is told.
    const { data: current } = await supabase
      .from("book_drafts")
      .select("digital_purchased_at, chapter_count")
      .eq("id", draftId)
      .maybeSingle();
    if (current && !current.digital_purchased_at) {
      await alertOps("A PDF was paid for but not released", {
        draft: draftId,
        paymentIntent: paymentIntentId,
        paidForChapters: limited ? paidChapters : "unknown",
        bookChapters: current.chapter_count,
        note: "The book on the draft is longer than the one the payment was for. Refund the payment, or charge the difference and release it by hand.",
      });
    }
    return;
  }

  await captureServerEvent(
    session.metadata?.posthogDistinctId || draftId,
    "digital_purchase_completed",
    { amount: (session.amount_total ?? 0) / 100 },
  );
  await captureServerEvent(
    session.metadata?.posthogDistinctId || draftId,
    "order_completed",
    {
      product: "digital",
      revenue: (session.amount_total ?? 0) / 100,
      currency: session.currency ?? "usd",
      draft_id: draftId,
    },
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
