import { readEnv, routeError } from "@/lib/env";
import {
  processNextVideoAsset,
  recoverStaleProcessing,
} from "@/lib/video-memory/process-job";

export async function GET(request: Request): Promise<Response> {
  try {
    const cronSecret = readEnv("CRON_SECRET");
    if (cronSecret) {
      const authorized =
        request.headers.get("authorization") === `Bearer ${cronSecret}`;
      if (!authorized) {
        return Response.json({ error: "Unauthorized." }, { status: 401 });
      }
    }

    const recovered = await recoverStaleProcessing();
    const processed = await processNextVideoAsset();
    return Response.json({ recovered, processed });
  } catch (error) {
    return routeError(error, "Video processing tick failed.");
  }
}
