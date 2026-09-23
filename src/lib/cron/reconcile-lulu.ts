import {
  fetchPrintJob,
  findPrintJobByExternalId,
  mapLuluStatus,
} from "@/lib/lulu/client";
import { alertOps } from "@/lib/ops/alert";
import { VIDEO_MEMORIES_STUCK_CUSTOMER } from "@/lib/video-memory/config";
import { supabaseAdmin } from "@/lib/supabase/server";

/**
 * Reconcile open print jobs when Lulu webhooks are missed or disabled.
 *
 * Polls Lulu for orders still in submitted/production (or paid without a job
 * id — looks up by external_id first, never auto-resubmits).
 */

const OPEN_STATUSES = ["paid", "submitted", "production"] as const;

/**
 * How long a Video Memory order may sit part-archived before somebody is
 * told. Archival is slow by nature, so this is generous; what it catches is
 * an order that has stopped rather than one that is taking its time.
 */
const ARCHIVE_STALL_HOURS = 12;

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
 * Its own bounded query rather than another status in the sweep: orders stay
 * in `needs_review` until a person moves them, so letting them into a query
 * ordered oldest-first would eventually fill every page of it and starve the
 * orders that are actually moving.
 */
async function adoptLostJobs(
  supabase: ReturnType<typeof supabaseAdmin>,
): Promise<number> {
  const { data: orders } = await supabase
    .from("orders")
    .select("id")
    .eq("status", "needs_review")
    .is("lulu_print_job_id", null)
    .order("created_at", { ascending: false })
    .limit(20);

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
          review_reason: null,
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
    Date.now() - ARCHIVE_STALL_HOURS * 60 * 60 * 1000,
  ).toISOString();

  const { data: stuck } = await supabase
    .from("orders")
    .select("id, fulfillment_stage, paid_at")
    .eq("status", "paid")
    .lt("paid_at", cutoff)
    .in("fulfillment_stage", ["pending_archive", "archiving", "preparing_print"])
    .limit(20);

  for (const order of stuck ?? []) {
    await supabase
      .from("orders")
      .update({
        status: "needs_review",
        review_reason: VIDEO_MEMORIES_STUCK_CUSTOMER,
      })
      .eq("id", order.id)
      .eq("status", "paid");

    await alertOps("A paid order has stopped part way through archiving", {
      order: order.id,
      stage: order.fulfillment_stage,
      paidAt: order.paid_at,
    });
  }

  return (stuck ?? []).length;
}
