import { authorizeCron } from "@/lib/cron/auth";
import { cleanupAssets } from "@/lib/cron/cleanup-assets";
import { expireDrafts } from "@/lib/cron/expire-drafts";
import { fulfillOrders } from "@/lib/cron/fulfill-orders";
import { processVideos } from "@/lib/cron/process-videos";
import { reconcileLulu } from "@/lib/cron/reconcile-lulu";
import { isConfigured, routeError } from "@/lib/env";

/**
 * Every scheduled job, in one invocation.
 *
 * The Vercel Hobby plan allows two cron entries, once a day each. Rather than
 * pay for more, all five jobs run here in sequence — one entry, one schedule,
 * the same work.
 *
 * Three properties make that safe. Every job is incremental (batch caps,
 * attempt counters, retry timestamps), so a run that stops early simply
 * resumes tomorrow. Every job is isolated, so one failure cannot rob the rest
 * of their turn. And the whole thing runs to a wall-clock budget, because a
 * function killed mid-job is the one outcome worth engineering against.
 */

/** The Hobby ceiling. Functions are killed at this point regardless. */
export const maxDuration = 60;

/**
 * Stop starting new jobs with this much of the budget gone, leaving room for
 * the one in flight to finish and for the response to be written.
 */
const BUDGET_MS = 45_000;

type JobOutcome = {
  job: string;
  status: "ok" | "failed" | "skipped";
  ms?: number;
  result?: Record<string, unknown>;
  error?: string;
  reason?: string;
};

/**
 * Ordered cheapest and most customer-visible first, so the jobs most likely to
 * matter are the ones that always get their turn.
 *
 * The two Video Memory jobs are gated on their own configuration. That feature
 * is off (`enableVideoMemories={false}`) and its keys are unset, so they would
 * otherwise spend budget doing nothing.
 */
const JOBS: {
  name: string;
  run: () => Promise<Record<string, unknown>>;
  enabled?: () => boolean;
  disabledReason?: string;
}[] = [
  { name: "expire-drafts", run: expireDrafts },
  { name: "cleanup-assets", run: cleanupAssets },
  { name: "reconcile-lulu", run: reconcileLulu },
  {
    name: "process-videos",
    run: processVideos,
    enabled: () => isConfigured("VIDEO_MEMORY_WRAP_KEY"),
    disabledReason: "Video Memories not configured",
  },
  {
    name: "fulfill-orders",
    run: fulfillOrders,
    enabled: () => isConfigured("VIDEO_MEMORY_WRAP_KEY", "TURBO_PAYMENT_KEY"),
    disabledReason: "Video Memory archival not configured",
  },
];

export async function GET(request: Request): Promise<Response> {
  const denied = authorizeCron(request);
  if (denied) return denied;

  try {
    const startedAt = Date.now();
    const outcomes: JobOutcome[] = [];

    for (const job of JOBS) {
      if (job.enabled && !job.enabled()) {
        outcomes.push({
          job: job.name,
          status: "skipped",
          reason: job.disabledReason,
        });
        continue;
      }

      if (Date.now() - startedAt > BUDGET_MS) {
        outcomes.push({
          job: job.name,
          status: "skipped",
          reason: "out of time this run; will run tomorrow",
        });
        continue;
      }

      const jobStartedAt = Date.now();
      try {
        const result = await job.run();
        outcomes.push({
          job: job.name,
          status: "ok",
          ms: Date.now() - jobStartedAt,
          result,
        });
      } catch (error) {
        // Logged and recorded, never rethrown: the remaining jobs still deserve
        // their turn, and a red cron in Vercel would hide which one broke.
        console.error(`[ourTailTales] Cron job failed: ${job.name}`, error);
        outcomes.push({
          job: job.name,
          status: "failed",
          ms: Date.now() - jobStartedAt,
          error: error instanceof Error ? error.message : "unknown",
        });
      }
    }

    return Response.json({
      ms: Date.now() - startedAt,
      ran: outcomes.filter((o) => o.status === "ok").length,
      failed: outcomes.filter((o) => o.status === "failed").length,
      skipped: outcomes.filter((o) => o.status === "skipped").length,
      jobs: outcomes,
    });
  } catch (error) {
    return routeError(error, "The daily run failed.");
  }
}
