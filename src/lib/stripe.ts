import Stripe from "stripe";

import { requireEnv } from "@/lib/env";

/**
 * A single Stripe client instance rather than a global API key, so the secret
 * key stays confined to server code.
 */
let cached: Stripe | null = null;

export function stripeClient(): Stripe {
  if (cached) return cached;
  const [secretKey] = requireEnv("STRIPE_SECRET_KEY");
  cached = new Stripe(secretKey);
  return cached;
}

export function toMinorUnits(amount: number): number {
  return Math.round(amount * 100);
}
