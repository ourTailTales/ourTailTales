import { readEnv, routeError } from "@/lib/env";
import {
  fetchPrintJob,
  findPrintJobByExternalId,
  mapLuluStatus,
} from "@/lib/lulu/client";
import { supabaseAdmin } from "@/lib/supabase/server";

/**
 * Reconcile open print jobs when Lulu webhooks are missed or disabled.
 *
 * Polls Lulu for orders still in submitted/production (or paid without a job
 * id — looks up by external_id first, never auto-resubmits).
 */

const OPEN_STATUSES = ["paid", "submitted", "production"] as const;

export async function GET(request: Request): Promise<Response> {
  try {
    const cronSecret = readEnv("CRON_SECRET");
    if (cronSecret) {
      const authorized =
        request.headers.get("authorization") === `Bearer ${cronSecret}`;
      if (!authorized) {
        return Response.json({ error: "Unauthorized." }, { status: 401 });
      }
    }

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

    return Response.json({ checked, updated, needsReview });
  } catch (error) {
    return routeError(error, "Lulu reconciliation failed.");
  }
}
