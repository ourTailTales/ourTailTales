import Stripe from "stripe";

import { readEnv, requireEnv } from "@/lib/env";

/**
 * A single Stripe client instance rather than a global API key, so the secret
 * key stays confined to server code.
 *
 * Which key is used is never decided here. Vercel scopes environment variables
 * per deployment environment, so production holds the live pair and preview and
 * local hold the test pair under the same names. Branching on the environment
 * in code to choose a secret would mean both keys had to be present wherever it
 * runs, which is precisely the thing worth avoiding.
 *
 * What this file does instead is refuse a mismatch, because the failure it
 * guards against is silent and expensive: a live key loaded in a preview branch
 * charges real cards against test data, and nothing in the response says so.
 */

export type DeploymentEnvironment = "production" | "preview" | "development";

/**
 * Vercel sets `VERCEL_ENV` on every deployment. Its absence means this is not a
 * Vercel deployment at all — a local server, a CI job, a script — so the answer
 * is "development" and never "production". `NODE_ENV` is deliberately not used
 * as a fallback: `next build && next start` on a laptop sets it to "production"
 * while being nothing of the sort, and trusting it would wave live keys through
 * on a developer's machine.
 */
export function deploymentEnvironment(): DeploymentEnvironment {
  const vercelEnv = readEnv("VERCEL_ENV");
  if (vercelEnv === "production" || vercelEnv === "preview" || vercelEnv === "development") {
    return vercelEnv;
  }
  return "development";
}

export function isLiveKey(key: string): boolean {
  return key.startsWith("sk_live_") || key.startsWith("pk_live_");
}

/**
 * Throws when live keys are loaded anywhere but production, and warns when
 * production is still on test keys.
 *
 * The asymmetry is intentional. Live keys outside production move real money
 * and must stop the request. Test keys in production take no money, which is a
 * problem to shout about but not one to break the site over — it is also the
 * expected state while a launch is being staged.
 */
export function assertStripeKeyMatchesEnvironment(
  secretKey: string,
  environment: DeploymentEnvironment = deploymentEnvironment(),
): void {
  const live = isLiveKey(secretKey);

  if (live && environment !== "production") {
    throw new Error(
      `Refusing to start Stripe: a LIVE secret key is configured in the "${environment}" environment. ` +
        `Live keys belong only to production. Set the test key for this environment in Vercel.`,
    );
  }

  if (!live && environment === "production") {
    console.warn(
      "[ourTailTales] Production is running on Stripe TEST keys — no real payment will be taken.",
    );
  }

  // The publishable key is inlined into the browser bundle at build time, so a
  // mismatched pair fails at checkout with an opaque Stripe error rather than
  // anything that names the cause. It is readable here, so it is checked here.
  const publishable = readEnv("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY");
  if (publishable && isLiveKey(publishable) !== live) {
    throw new Error(
      "Refusing to start Stripe: the secret and publishable keys are from different modes " +
        `(secret is ${live ? "live" : "test"}, publishable is ${isLiveKey(publishable) ? "live" : "test"}).`,
    );
  }
}

let cached: Stripe | null = null;

export function stripeClient(): Stripe {
  if (cached) return cached;
  const [secretKey] = requireEnv("STRIPE_SECRET_KEY");
  assertStripeKeyMatchesEnvironment(secretKey);
  cached = new Stripe(secretKey);
  return cached;
}

export function toMinorUnits(amount: number): number {
  return Math.round(amount * 100);
}
