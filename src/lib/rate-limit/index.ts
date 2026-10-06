import { createHash } from "node:crypto";

import { MAX_CHAPTERS } from "@/lib/pricing";
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
  /**
   * A Gemini generation per call, with images attached. The expensive one.
   *
   * Derived from `MAX_CHAPTERS` rather than picked: writing the largest book
   * we sell costs exactly one call per chapter, in a burst, so any fixed
   * number below that rate-limits a paying customer halfway through their own
   * book. The headroom covers failed chapters retried and single chapters
   * regenerated from the editor afterwards.
   */
  story: { name: "story", limit: MAX_CHAPTERS + 30, windowSeconds: 60 * 10 },
  /**
   * The one look at the pet before a book is written: one call per book,
   * plus a few for retries and people starting over.
   */
  profile: { name: "profile", limit: 10, windowSeconds: 60 * 10 },
  /** Lulu API calls against our quota. */
  lulu: { name: "lulu", limit: 60, windowSeconds: 60 * 10 },
  /** Rows in our database, and the start of every funnel. */
  draft: { name: "draft", limit: 20, windowSeconds: 60 * 10 },
  /**
   * Opening an order and asking for somewhere to put its print files.
   *
   * Its own namespace rather than sharing the draft budget: an office behind
   * one address retrying a big upload would otherwise spend the allowance
   * that lets anyone there start a book at all, and a limiter that closes the
   * front door is worse than the abuse it was added for.
   */
  order: { name: "order", limit: 40, windowSeconds: 60 * 10 },
  /**
   * Banking a rendered book. The most expensive thing we run: it downloads a
   * whole book, stamps every page and uploads it twice, with a sixty second
   * budget, behind a draft anyone can mint.
   */
  bank: { name: "bank", limit: 12, windowSeconds: 60 * 10 },
  /**
   * Setting up the payment for one order. Each call asks the printer for a
   * price, asks Stripe Tax for the tax and updates the payment, and Stripe
   * bills for tax calculations. Counted per order: a customer changing their
   * mind about delivery a dozen times never meets it.
   */
  payment: { name: "payment", limit: 30, windowSeconds: 60 * 10 },
  /**
   * Everybody's AI calls in a day, added together.
   *
   * The per-address limits above bound one visitor. Nothing bounded all of
   * them, so a script behind a pool of addresses could run the model bill up
   * without ever meeting a limit. These are ceilings, not targets: three
   * thousand chapter calls is several hundred books in a day. Counted under
   * one shared subject, and they refuse when the limiter itself cannot be
   * reached, because an unbounded day is the thing they exist to prevent.
   */
  storyDaily: { name: "story_daily", limit: 3000, windowSeconds: 60 * 60 * 24 },
  profileDaily: { name: "profile_daily", limit: 600, windowSeconds: 60 * 60 * 24 },
  /** Every sample email sent in a day, to protect the sending domain. */
  sampleDaily: { name: "sample_daily", limit: 400, windowSeconds: 60 * 60 * 24 },
  /**
   * Asking for somewhere to upload a book to, per draft. Each answer is a
   * storage URL good for fifty megabytes.
   */
  bankSign: { name: "bank_sign", limit: 30, windowSeconds: 60 * 10 },
  /** Email capture. Generous enough for retries, tight enough to bore a bot. */
  lead: { name: "lead", limit: 10, windowSeconds: 60 * 10 },
  /** Outbound calls to the geocoder. One per chapter while editing. */
  geocode: { name: "geocode", limit: 120, windowSeconds: 60 * 10 },
  /**
   * Mail we send on a visitor's say-so, with an attachment, from our own
   * verified domain.
   *
   * The tightest budget here, and not because the send costs much. A route
   * that mails an arbitrary address an arbitrary attachment is a relay, and a
   * relay is how a sending domain gets blacklisted. Nobody legitimately needs
   * their own first pages more than a handful of times.
   */
  sample: { name: "sample", limit: 5, windowSeconds: 60 * 10 },
  /**
   * Minting a Stripe Checkout Session for the digital PDF.
   *
   * Cheap for us, but it is still a live call against Stripe's API behind a
   * draft secret that a shared link necessarily exposes to whoever holds it.
   * Loose enough that a real customer retrying a declined card never notices.
   */
  checkoutDigital: { name: "checkout_digital", limit: 15, windowSeconds: 60 * 10 },
  /**
   * Signing a Video Memory upload: a storage URL good for up to the source
   * cap, and a `video_assets` row, behind a draft anyone can mint. Counted per
   * address and again per draft. Above the per-draft asset cap, so a customer
   * filling a library in one sitting, with retries, never meets it.
   */
  videoAuthorize: { name: "video_authorize", limit: 60, windowSeconds: 60 * 10 },
} as const satisfies Record<string, RateLimit>;

/** The one subject every caller shares, for the daily ceilings. */
export const GLOBAL_SUBJECT = "global";

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
  /**
   * What to count against, when the caller's address is the wrong subject.
   *
   * An address is the right subject for an anonymous route. For a route that
   * is already authenticated it is the weaker of the two: one draft behind a
   * pool of addresses still gets one budget this way.
   */
  subject?: string,
  /**
   * Refuse when the limiter cannot answer. Off by default: a limiter that is
   * down must not close the site. On for the shared daily ceilings, which
   * exist to bound spend and bound nothing if they give way under load.
   */
  options: { failClosed?: boolean } = {},
): Promise<Response | null> {
  if (!supabaseConfigured()) return null;

  const unavailable = (): Response | null =>
    options.failClosed
      ? Response.json(
          {
            error: "We are very busy right now. Please try again in a few minutes.",
            code: "rate_limited",
          },
          { status: 503, headers: { "retry-after": "300" } },
        )
      : null;

  try {
    const { data, error } = await supabaseAdmin().rpc("rate_limit_hit", {
      p_bucket: `${limit.name}:${subject ?? clientKey(request)}`,
      p_window_seconds: limit.windowSeconds,
      p_limit: limit.limit,
    });

    if (error) {
      console.error("[ourTailTales] Rate limiter unavailable", error);
      return unavailable();
    }
    if (data === false) {
      // A shared ceiling being reached is something a person should see in
      // the log: either the day is going very well or something is wrong.
      if (subject === GLOBAL_SUBJECT) {
        console.error(`[ourTailTales] OPS: the ${limit.name} ceiling was reached`);
      }
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
    return unavailable();
  }
}
