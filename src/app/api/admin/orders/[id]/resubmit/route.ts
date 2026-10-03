import type Stripe from "stripe";

import { authorizeCron } from "@/lib/cron/auth";
import { routeError } from "@/lib/env";
import {
  confirmByEmail,
  includeDigitalCopy,
  quietly,
} from "@/lib/order/after-payment";
import { AMOUNT_MISMATCH_REASON, expectedOrderAmount } from "@/lib/order/amount";
import { freezePrintFiles } from "@/lib/order/freeze-print-files";
import { markNeedsReview, submitPaidOrderToLulu } from "@/lib/order/submit-print";
import { stripeClient } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabase/server";

export const maxDuration = 60;

/** Stages in which an order's Video Memories are still being preserved. */
const ARCHIVAL_STAGES = ["pending_archive", "archiving", "preparing_print"];

/**
 * Sends a stuck paid order to the printer again.
 *
 * Nothing resubmits by itself, on purpose: printing cannot be undone. But
 * that left an order held for review with no way forward except making it by
 * hand at the printer or refunding it. This is the way forward, for a person
 * who has looked at the order and decided it should print.
 *
 *   curl -X POST https://www.ourtailtales.com/api/admin/orders/<id>/resubmit \
 *     -H "Authorization: Bearer $CRON_SECRET"
 *
 * Guarded by the cron secret, which is the one operator credential the
 * deployment already has. Only an order that was paid and has no print job is
 * touched. `submitPaidOrderToLulu` asks the printer whether it already has the
 * order before creating anything, so calling this twice cannot print twice.
 *
 * The payment is asked about first, at Stripe, every time. An order is held
 * for many reasons and some of them are that the money went back: this must
 * never print a book that was refunded or is being disputed, whoever asks.
 * It also refuses an order whose payment is not the amount the order costs,
 * which is the hold the webhook places when delivery details changed after
 * the amount was fixed. Once the difference has been charged or refunded by
 * hand, `?force=amount` lets that one check through. Nothing lets a refund or
 * a dispute through.
 *
 * Orders with Video Memories are refused: they print from a file rebuilt
 * after archival, and sending them from here would print the book without it.
 *
 * A held order with a print job already at the printer is not resubmitted. It
 * is released: see the sibling `release` route.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const unauthorized = authorizeCron(request);
  if (unauthorized) return unauthorized;

  try {
    const { id } = await params;
    if (!/^[0-9a-f-]{36}$/i.test(id)) {
      return Response.json({ error: "Unknown order." }, { status: 404 });
    }
    const forceAmount = new URL(request.url).searchParams.get("force") === "amount";

    const supabase = supabaseAdmin();
    const { data: order, error } = await supabase
      .from("orders")
      .select(
        "id, status, paid_at, lulu_print_job_id, stripe_payment_intent_id, book_price, quantity, shipping_price, video_memory_total_cents, selected_video_count, fulfillment_stage, review_reason, draft_id, chapter_count",
      )
      .eq("id", id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!order) return Response.json({ error: "Unknown order." }, { status: 404 });

    if (!order.paid_at) {
      return Response.json({ error: "This order was never paid for." }, { status: 409 });
    }
    if (order.lulu_print_job_id) {
      return Response.json(
        {
          error:
            "This order already has a print job. To put a held order back in the queue, POST /api/admin/orders/<id>/release.",
          printJob: order.lulu_print_job_id,
        },
        { status: 409 },
      );
    }
    if (order.status !== "needs_review" && order.status !== "paid") {
      return Response.json(
        { error: `An order that is ${order.status} cannot be resubmitted.` },
        { status: 409 },
      );
    }
    if (
      Number(order.selected_video_count ?? 0) > 0 ||
      ARCHIVAL_STAGES.includes(order.fulfillment_stage ?? "")
    ) {
      return Response.json(
        {
          error:
            "This order has Video Memories, which are printed from a file made after archival. It cannot be resubmitted from here.",
        },
        { status: 409 },
      );
    }
    if (!order.stripe_payment_intent_id) {
      return Response.json(
        { error: "This order has no payment recorded against it." },
        { status: 409 },
      );
    }

    // Asked of Stripe rather than read from the order: the order's status is
    // exactly the thing that is in doubt.
    let intent: Stripe.PaymentIntent;
    try {
      intent = await stripeClient().paymentIntents.retrieve(
        order.stripe_payment_intent_id,
        { expand: ["latest_charge"] },
      );
    } catch (stripeError) {
      console.error("[ourTailTales] Could not read the payment for", id, stripeError);
      return Response.json(
        { error: "The payment could not be checked with Stripe. Nothing was sent to print." },
        { status: 502 },
      );
    }

    const refusal = paymentRefusal(intent, expectedOrderAmount(order), forceAmount);
    if (refusal) {
      return Response.json(
        { error: refusal, paymentIntent: intent.id },
        { status: 409 },
      );
    }

    // The one hold placed before the customer was sent anything. Every other
    // hold happens after the confirmation has gone out, so only this one
    // still owes it. Read now, because reopening clears the reason.
    const confirmationOwed = order.review_reason === AMOUNT_MISMATCH_REASON;

    // Idempotent: returns true at once when the files were frozen at payment.
    const frozen = await freezePrintFiles(id);
    if (!frozen) {
      return Response.json(
        { error: "The print files for this order are missing." },
        { status: 409 },
      );
    }

    // Conditional on the status that was checked, so a refund that cancels
    // the order between the check and here is not undone by this write.
    const { data: reopened, error: reopenError } = await supabase
      .from("orders")
      .update({ status: "paid", review_reason: null })
      .eq("id", id)
      .eq("status", order.status)
      .is("lulu_print_job_id", null)
      .select("id");
    if (reopenError) throw new Error(reopenError.message);
    if (!reopened || reopened.length === 0) {
      return Response.json(
        { error: "This order changed while it was being checked. Look at it again before retrying." },
        { status: 409 },
      );
    }

    try {
      await submitPaidOrderToLulu(id);
    } catch (submitError) {
      await markNeedsReview(
        id,
        submitError instanceof Error ? submitError.message : "Lulu submission failed.",
      );
      if (confirmationOwed) await keepConfirmationOwed(id);
      return Response.json(
        { ok: false, error: "The printer refused the order. It is back in review." },
        { status: 502 },
      );
    }

    const { data: after, error: afterError } = await supabase
      .from("orders")
      .select("status, lulu_print_job_id, review_reason")
      .eq("id", id)
      .maybeSingle();
    if (afterError) throw new Error(afterError.message);

    const submitted = Boolean(after?.lulu_print_job_id);

    // What the webhook does once a book is on its way to print. The unlock is
    // conditional on not having happened, so it is safe to run for any order.
    let confirmationSent = false;
    if (submitted) {
      if (confirmationOwed) {
        await quietly("Order confirmation email", () => confirmByEmail(id), 10_000);
        confirmationSent = true;
      }
      await quietly("Included PDF unlock", () =>
        includeDigitalCopy({
          draftId: order.draft_id,
          paymentIntentId: intent.id,
          chapterCount: order.chapter_count,
        }),
      );
    } else if (confirmationOwed && after?.status === "needs_review") {
      await keepConfirmationOwed(id);
    }

    return Response.json({
      ok: submitted,
      status: after?.status ?? null,
      printJob: after?.lulu_print_job_id ?? null,
      // Attempted, not delivered: the send is best effort and logs its own failure.
      confirmationEmail: confirmationSent ? "attempted" : "not_owed_or_not_sent",
      ...(submitted ? {} : { heldBecause: after?.review_reason ?? null }),
    });
  } catch (error) {
    return routeError(error, "The order could not be resubmitted.");
  }
}

/**
 * Puts the amount-mismatch reason back on an order the submission held again.
 *
 * That reason is how the next run knows the customer has still not been sent
 * a confirmation. The reason the submission gave has already gone to a person
 * by alert, and comes back in this route's answer.
 */
async function keepConfirmationOwed(orderId: string): Promise<void> {
  const { error } = await supabaseAdmin()
    .from("orders")
    .update({ review_reason: AMOUNT_MISMATCH_REASON })
    .eq("id", orderId)
    .eq("status", "needs_review")
    .is("lulu_print_job_id", null);
  if (error) {
    console.error("[ourTailTales] Could not restore the hold reason", orderId, error);
  }
}

/**
 * Why this payment does not entitle the order to print, or null when it does.
 *
 * `forceAmount` skips the comparison of what was paid with what the order
 * costs, and only that.
 */
function paymentRefusal(
  intent: Stripe.PaymentIntent,
  expected: number | null,
  forceAmount: boolean,
): string | null {
  if (intent.status !== "succeeded") {
    return `The payment is ${intent.status}, not succeeded. Nothing was sent to print.`;
  }

  const charge =
    intent.latest_charge && typeof intent.latest_charge !== "string"
      ? intent.latest_charge
      : null;
  if (!charge) {
    return "The charge behind this payment could not be read, so a refund or dispute cannot be ruled out. Nothing was sent to print.";
  }
  // A full refund ends it. A part refund is how an overpayment is put right,
  // which is exactly what the hold tells the operator to do, so it is counted
  // in the amount check below rather than refused outright.
  if (charge.refunded || charge.amount_refunded >= charge.amount) {
    return `This payment has been refunded (${charge.amount_refunded} of ${charge.amount} cents). A refunded order is not printed.`;
  }
  const kept = intent.amount_received - charge.amount_refunded;
  if (charge.disputed) {
    return "This payment is disputed. A disputed order is not printed.";
  }

  if (!forceAmount) {
    if (expected === null) {
      return "This order has no locked shipping price, so what it should have cost is unknown. Settle the amount by hand, then retry with ?force=amount.";
    }
    if (kept !== expected) {
      return `The payment kept ${kept} cents after refunds and the order costs ${expected} cents. Charge or refund the difference, then retry with ?force=amount.`;
    }
  }
  return null;
}
