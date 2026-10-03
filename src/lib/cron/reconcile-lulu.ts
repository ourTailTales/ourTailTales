import { markNeedsReview } from "@/lib/order/submit-print";
import {
  fetchPrintJob,
  findPrintJobByExternalId,
  isMissingPrintJobError,
  mapLuluStatus,
} from "@/lib/lulu/client";
import { sendShippingNotificationEmail } from "@/lib/email/send";
import { alertOps } from "@/lib/ops/alert";
import { supabaseAdmin } from "@/lib/supabase/server";

/**
 * Reconcile open print jobs when Lulu webhooks are missed or disabled.
 *
 * Polls Lulu for orders still in submitted/production (or paid without a job
 * id — looks up by external_id first, never auto-resubmits).
 */

const OPEN_STATUSES = ["paid", "submitted", "production"] as const;

/**
 * How long a Video Memory order may sit part-archived before somebody is told.
 *
 * Measured in days rather than hours, because archival is genuinely slow: the
 * dispatcher runs once a day and takes one video per run, so an order with
 * five videos legitimately takes the better part of a week. A threshold of
 * hours does not describe a stalled order, it describes every order.
 */
const ARCHIVE_STALL_DAYS = 10;

/** Lulu calls and mail are not free, and this runs ahead of the work that
 *  actually moves books. Both passes stay small on purpose. */
const SIDE_PASS_LIMIT = 5;

/**
 * Extracted from the route handler so the daily dispatcher can call it
 * directly, without a second HTTP hop or a second cold start.
 */
export async function reconcileLulu(): Promise<Record<string, unknown>> {
  const supabase = supabaseAdmin();
  const { data: orders, error } = await supabase
    .from("orders")
    .select(
      "id, status, email, pet_name, lulu_print_job_id, review_reason, fulfillment_stage, selected_video_count",
    )
    .in("status", [...OPEN_STATUSES])
    .order("created_at", { ascending: true })
    .limit(50);

  if (error) throw new Error(error.message);

  let checked = 0;
  let updated = 0;
  let needsReview = 0;

  for (const order of orders ?? []) {
    checked += 1;

    try {
      // What the row said when it was read, kept in step with the one write
      // this loop makes ahead of the status update. Every later write is
      // conditional on it, so anything that moved the order in the meantime
      // (the printer's webhook, a refund, a person) wins.
      let knownStatus: string = order.status;

      let printJob = order.lulu_print_job_id
        ? await fetchPrintJob(order.lulu_print_job_id)
        : null;

      if (!printJob) {
        printJob = await findPrintJobByExternalId(order.id);
        if (printJob) {
          const { data: adoptedRows, error: adoptError } = await supabase
            .from("orders")
            .update({
              lulu_print_job_id: String(printJob.id),
              status: "submitted",
              submitted_at: new Date().toISOString(),
            })
            .eq("id", order.id)
            .eq("status", knownStatus)
            .is("lulu_print_job_id", null)
            .select("id");
          if (adoptError) throw new Error(adoptError.message);
          // Somebody else got to this order first. Leave it to them.
          if (!adoptedRows || adoptedRows.length === 0) continue;
          knownStatus = "submitted";
          updated += 1;
        } else if (order.status === "paid") {
          const awaitingArchive =
            Number(order.selected_video_count ?? 0) > 0 &&
            ["pending_archive", "archiving", "preparing_print"].includes(
              order.fulfillment_stage ?? "",
            );
          if (awaitingArchive) continue;

          // Paid but no Lulu job found — do not resubmit automatically.
          console.error(
            "[ourTailTales] Paid order missing Lulu job; needs review",
            order.id,
          );
          const { error: holdError } = await supabase
            .from("orders")
            .update({
              status: "needs_review",
              review_reason:
                order.review_reason ??
                "Payment succeeded but no Lulu print job was found. Manual review required.",
            })
            .eq("id", order.id)
            .eq("status", "paid");
          await alertOps("A paid order has no print job", {
            order: order.id,
            note: holdError
              ? `The hold could NOT be written to the order: ${holdError.message}`
              : "Check it, then POST /api/admin/orders/<id>/resubmit with the cron secret.",
          });
          if (holdError) throw new Error(holdError.message);
          needsReview += 1;
          continue;
        } else {
          continue;
        }
      }

      const luluStatus = printJob.status?.name;
      if (!luluStatus) continue;

      const mapped = mapLuluStatus(luluStatus);
      if (!mapped) continue;

      const nextStatus = mapped === "rejected" ? "needs_review" : mapped;
      const update: Record<string, unknown> = {
        status: nextStatus,
        lulu_status: luluStatus,
        lulu_status_message: printJob.status?.message ?? null,
      };

      if (printJob.tracking_urls?.length) {
        update.tracking_urls = printJob.tracking_urls;
      }

      if (mapped === "rejected") {
        update.review_reason = `Lulu rejected the job: ${
          printJob.status?.message ?? "no reason given"
        }`;
      }

      // Conditional on the status read above. The printer's webhook may have
      // moved this order since, in which case it has already sent the shipped
      // email, and a hold placed while this run was in flight must not be
      // overwritten by what the printer said a moment earlier.
      const { data: applied, error: updateError } = await supabase
        .from("orders")
        .update(update)
        .eq("id", order.id)
        .eq("status", knownStatus)
        .select("id");

      if (updateError) throw new Error(updateError.message);
      if (!applied || applied.length === 0) continue;
      if (nextStatus !== order.status) updated += 1;

      if (mapped === "rejected") {
        console.error(
          "[ourTailTales] Reconcile: Lulu rejected",
          order.id,
          printJob.status?.message,
        );
        needsReview += 1;
        await alertOps("The printer rejected an order", {
          order: order.id,
          reason: printJob.status?.message ?? "no reason given",
        });
      }

      // The shipped email used to be sent only from the printer's webhook. If
      // that webhook was missed, or this job got here first, nobody was told
      // their book was on its way. Sent only when the write above actually
      // moved the row, which is what makes it fire once: the webhook's own
      // update is conditional the same way, so only one of the two can win.
      if (nextStatus === "shipped" && order.email) {
        await sendShippingNotificationEmail({
          to: order.email,
          petName: order.pet_name ?? "",
          orderId: order.id,
          trackingUrl: printJob.tracking_urls?.[0] ?? null,
        }).catch((sendError: unknown) => {
          console.error("[ourTailTales] Shipping email failed", order.id, sendError);
        });
      }
    } catch (jobError) {
      console.error(
        "[ourTailTales] Reconcile failed for order",
        order.id,
        jobError,
      );
      // A job the printer no longer knows will never answer differently. Left
      // alone it failed here every night for good while the customer's page
      // went on saying "Sent to the printer".
      //
      // Only when the printer itself said so: a 404 for this order's own print
      // job. Matching on the text of the message also caught a failed sign-in
      // and 404s from other calls, which on a bad night would have put every
      // open order on hold at once.
      if (isMissingPrintJobError(jobError, order.lulu_print_job_id)) {
        try {
          await markNeedsReview(
            order.id,
            "The printer has no record of this print job. It is being checked by hand.",
          );
          needsReview += 1;
        } catch (holdError) {
          // Already alerted and logged. One order must not stop the rest.
          console.error("[ourTailTales] Could not hold a lost job", order.id, holdError);
        }
      }
    }
  }

  const adopted = await adoptLostJobs(supabase);
  const stalled = await flagStalledArchives(supabase);

  return { checked, updated, needsReview, adopted, stalled };
}

/**
 * Finds print jobs that exist at Lulu but that we lost the receipt for.
 *
 * A POST that succeeds while its response is lost leaves the order flagged
 * for review with no job id, and `needs_review` is not one of the statuses
 * the sweep above looks at, so nothing ever went back for it. The job sat at
 * Lulu, invisible, until a human "retried" it and printed a second book.
 *
 * Its own small query rather than another status in the sweep: orders stay in
 * `needs_review` until a person moves them, so letting them into the main
 * oldest-first query would eventually fill every page of it and starve the
 * orders that are actually moving.
 *
 * Newest first, and only a handful, which means this is a safety net for a
 * receipt lost recently rather than an exhaustive search. An older one is not
 * silently abandoned: `markNeedsReview` mails a person the moment it happens,
 * which is the part that was missing. `review_reason` is left alone here so
 * adoption cannot wipe a note somebody wrote on the order.
 */
async function adoptLostJobs(
  supabase: ReturnType<typeof supabaseAdmin>,
): Promise<number> {
  const { data: orders, error: readError } = await supabase
    .from("orders")
    .select("id")
    .eq("status", "needs_review")
    .is("lulu_print_job_id", null)
    .not("paid_at", "is", null)
    .order("created_at", { ascending: false })
    .limit(SIDE_PASS_LIMIT);
  if (readError) {
    console.error("[ourTailTales] Could not look for lost print jobs", readError);
    return 0;
  }

  let adopted = 0;
  for (const order of orders ?? []) {
    try {
      const printJob = await findPrintJobByExternalId(order.id);
      if (!printJob) continue;
      const { error } = await supabase
        .from("orders")
        .update({
          lulu_print_job_id: String(printJob.id),
          lulu_status: printJob.status?.name ?? null,
          status: "submitted",
          submitted_at: new Date().toISOString(),
        })
        .eq("id", order.id)
        .is("lulu_print_job_id", null);
      if (error) throw new Error(error.message);
      adopted += 1;
      await alertOps("Adopted a Lulu job we had lost the receipt for", {
        order: order.id,
        printJob: String(printJob.id),
      });
    } catch (jobError) {
      console.error("[ourTailTales] Could not adopt a lost job", order.id, jobError);
    }
  }
  return adopted;
}

/**
 * Notices a paid Video Memory order whose archival has stopped.
 *
 * `VIDEO_MEMORIES_STUCK_CUSTOMER` is rendered by the order page and nothing
 * in the codebase ever set it, so the one state the page was written to
 * explain could not occur. Meanwhile the sweep above steps over these orders
 * on purpose, because awaiting archival is a legitimate place to be — for a
 * while.
 */
async function flagStalledArchives(
  supabase: ReturnType<typeof supabaseAdmin>,
): Promise<number> {
  const cutoff = new Date(
    Date.now() - ARCHIVE_STALL_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();

  const { data: stuck, error: readError } = await supabase
    .from("orders")
    .select("id, fulfillment_stage, paid_at")
    .eq("status", "paid")
    .lt("paid_at", cutoff)
    .in("fulfillment_stage", ["pending_archive", "archiving", "preparing_print"])
    .limit(SIDE_PASS_LIMIT);
  if (readError) {
    console.error("[ourTailTales] Could not look for stalled archives", readError);
    return 0;
  }

  if (!stuck || stuck.length === 0) return 0;

  // Deliberately no write.
  //
  // The obvious thing here is to set `needs_review`, which is what the order
  // page reads to explain a stuck order to the customer. It is also what
  // `mayStartArchival` and `maybeFinishOrders` both refuse to act on, so
  // marking a slow order as stuck is not an alert at all: it is a permanent
  // stop, applied by a watchdog, to the orders it was written to rescue. One
  // mail to a person who can look is the whole of the useful part.
  await alertOps(
    `${stuck.length} paid order(s) have stopped part way through archiving`,
    {
      orders: stuck.map((order) => order.id).join(", "),
      stages: stuck.map((order) => order.fulfillment_stage ?? "?").join(", "),
      oldestPaidAt: stuck[0]?.paid_at ?? "",
      note: `Still 'paid' and mid-archive after ${ARCHIVE_STALL_DAYS} days. Nothing has been changed on these orders.`,
    },
  );

  return stuck.length;
}
