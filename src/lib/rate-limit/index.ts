import { createHash } from "node:crypto";

import { supabaseAdmin, supabaseConfigured } from "@/lib/supabase/server";

/**
 * Fixed-window rate limiting for the public, unauthenticated routes.
 *
 * Counted in Postgres, not in memory: Vercel runs as many instances as the
 * load demands, so an in-process counter is defeated by exactly the
 * concurrency it exists to stop.
 *
 * Fails OPEN. A limiter that takes the site down when the database hiccups is
 * worse than the abuse it prevents — but it says so loudly in the log.
 */

export type RateLimit = {
  /** Namespace, so two routes never share a budget. */
  name: string;
  /** Requests allowed per window, per client. */
  limit: number;
  windowSeconds: number;
};

/**
 * Budgets are set by what a call costs us, not by what feels generous.
 * A human making one book will not notice any of these.
 */
export const LIMITS = {
  /** A Gemini generation per call, with images attached. The expensive one. */
  story: { name: "story", limit: 20, windowSeconds: 60 * 10 },
  /** Lulu API calls against our quota. */
  lulu: { name: "lulu", limit: 60, windowSeconds: 60 * 10 },
  /** Rows in our database, and the start of every funnel. */
  draft: { name: "draft", limit: 20, windowSeconds: 60 * 10 },
  /** Email capture. Generous enough for retries, tight enough to bore a bot. */
  lead: { name: "lead", limit: 10, windowSeconds: 60 * 10 },
  /** Outbound calls to the geocoder. One per chapter while editing. */
  geocode: { name: "geocode", limit: 120, windowSeconds: 60 * 10 },
} as const satisfies Record<string, RateLimit>;

/**
 * Best available caller identity.
 *
 * Vercel sets `x-forwarded-for` and its leftmost entry is the client. It is
 * spoofable in principle, but behind Vercel's proxy the header is rewritten,
 * so this is the honest signal available. Hashed so the log and the table
 * never hold a raw IP.
 */
function clientKey(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for") ?? "";
  const ip =
    forwarded.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip")?.trim() ||
    "unknown";
  return createHash("sha256").update(ip).digest("hex").slice(0, 32);
}

/**
 * Returns a 429 to send back, or null when the caller may proceed.
 */
export async function enforceRateLimit(
  request: Request,
  limit: RateLimit,
): Promise<Response | null> {
  if (!supabaseConfigured()) return null;

  try {
    const { data, error } = await supabaseAdmin().rpc("rate_limit_hit", {
      p_bucket: `${limit.name}:${clientKey(request)}`,
      p_window_seconds: limit.windowSeconds,
      p_limit: limit.limit,
    });

    if (error) {
      console.error("[ourTailTales] Rate limiter unavailable", error);
      return null;
    }
    if (data === false) {
      return Response.json(
        {
          error:
            "That is a lot of requests in a short time. Give it a minute and try again.",
          code: "rate_limited",
        },
        {
          status: 429,
          headers: { "retry-after": String(limit.windowSeconds) },
        },
      );
    }
    return null;
  } catch (error) {
    console.error("[ourTailTales] Rate limiter threw", error);
    return null;
  }
}
