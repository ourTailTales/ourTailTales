import { authorizeCron } from "@/lib/cron/auth";
import { cleanupAssets } from "@/lib/cron/cleanup-assets";
import { routeError } from "@/lib/env";

/**
 * Kept as its own endpoint so this job can be run on demand while debugging.
 * The daily schedule no longer calls it: `api/cron/daily` runs every job in one
 * invocation, because the Vercel Hobby plan allows only two cron entries.
 */
export async function GET(request: Request): Promise<Response> {
  const denied = authorizeCron(request);
  if (denied) return denied;

  try {
    return Response.json(await cleanupAssets());
  } catch (error) {
    return routeError(error, "Cleanup failed.");
  }
}
