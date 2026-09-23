import { Resend } from "resend";

import { readEnv } from "@/lib/env";

/**
 * Single Resend client, server-only.
 *
 * Returns null when `RESEND_API_KEY` is unset rather than throwing. Email is
 * never the point of a request here — it follows a book that has already been
 * made or an order that has already been paid for — so a missing key degrades
 * to "no mail sent" instead of failing the thing the customer actually asked
 * for. It is still loud in the log.
 */
let cached: Resend | null = null;

export function resendClient(): Resend | null {
  const apiKey = readEnv("RESEND_API_KEY");
  if (!apiKey) return null;
  cached ??= new Resend(apiKey);
  return cached;
}

/** Verified sender. Resend's shared onboarding domain is the dev fallback. */
export function emailFrom(): string {
  return readEnv("EMAIL_FROM") ?? "ourTailTales <onboarding@resend.dev>";
}
