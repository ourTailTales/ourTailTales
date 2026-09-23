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
  if (!cronSecret) return null;

  const authorized =
    request.headers.get("authorization") === `Bearer ${cronSecret}`;
  if (authorized) return null;

  return Response.json({ error: "Unauthorized." }, { status: 401 });
}
