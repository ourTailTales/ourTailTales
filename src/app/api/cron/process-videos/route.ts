import { authorizeCron } from "@/lib/cron/auth";
import { processVideos } from "@/lib/cron/process-videos";
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
    return Response.json(await processVideos());
  } catch (error) {
    return routeError(error, "Video processing tick failed.");
  }
}
