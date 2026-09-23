import {
  fetchPrintJob,
  findPrintJobByExternalId,
  mapLuluStatus,
} from "@/lib/lulu/client";
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
      "id, status, lulu_print_job_id, review_reason, fulfillment_stage, selected_video_count",
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
      let printJob = order.lulu_print_job_id
        ? await fetchPrintJob(order.lulu_print_job_id)
        : null;

      if (!printJob) {
        printJob = await findPrintJobByExternalId(order.id);
        if (printJob) {
          await supabase
            .from("orders")
            .update({
              lulu_print_job_id: String(printJob.id),
              status: "submitted",
              submitted_at: new Date().toISOString(),
            })
            .eq("id", order.id)
            .is("lulu_print_job_id", null);
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
          await supabase
            .from("orders")
            .update({
              status: "needs_review",
              review_reason:
                order.review_reason ??
                "Payment succeeded but no Lulu print job was found. Manual review required.",
            })
            .eq("id", order.id)
            .eq("status", "paid");
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
        console.error(
          "[ourTailTales] Reconcile: Lulu rejected",
          order.id,
          printJob.status?.message,
        );
        needsReview += 1;
      }

      const { error: updateError } = await supabase
        .from("orders")
        .update(update)
        .eq("id", order.id);

      if (updateError) throw new Error(updateError.message);
      if (nextStatus !== order.status) updated += 1;
    } catch (jobError) {
      console.error(
        "[ourTailTales] Reconcile failed for order",
        order.id,
        jobError,
      );
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
  const { data: orders } = await supabase
    .from("orders")
    .select("id")
    .eq("status", "needs_review")
    .is("lulu_print_job_id", null)
    .not("paid_at", "is", null)
    .order("created_at", { ascending: false })
    .limit(SIDE_PASS_LIMIT);

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

  const { data: stuck } = await supabase
    .from("orders")
    .select("id, fulfillment_stage, paid_at")
    .eq("status", "paid")
    .lt("paid_at", cutoff)
    .in("fulfillment_stage", ["pending_archive", "archiving", "preparing_print"])
    .limit(SIDE_PASS_LIMIT);

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
