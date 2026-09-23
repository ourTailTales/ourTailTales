import { readEnv } from "@/lib/env";

/**
 * Shared guard for every cron entry point.
 *
 * Was copy-pasted identically into all five cron routes. One copy means one
 * place to get it wrong, and one place to fix it.
 *
 * Returns null when the caller may proceed, or the response to send back.
 */
export function authorizeCron(request: Request): Response | null {
  const cronSecret = readEnv("CRON_SECRET");

  // Unset is convenient locally and dangerous in production: without a secret
  // every job — including the sweep that deletes expired books — is a public
  // GET. Local development stays open; a deployment fails closed, so a missing
  // variable shows up as a broken cron rather than an open one.
  if (!cronSecret) {
    if (readEnv("VERCEL_ENV")) {
      console.error(
        "[ourTailTales] CRON_SECRET is unset on a deployment — refusing to run cron jobs.",
      );
      return Response.json({ error: "Unauthorized." }, { status: 401 });
    }
    return null;
  }

  const authorized =
    request.headers.get("authorization") === `Bearer ${cronSecret}`;
  if (authorized) return null;

  return Response.json({ error: "Unauthorized." }, { status: 401 });
}
