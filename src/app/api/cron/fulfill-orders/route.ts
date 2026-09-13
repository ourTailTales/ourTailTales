import { fulfillNextVideoMemory } from "@/lib/archival/fulfill";
import { readEnv, routeError } from "@/lib/env";

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

    const processed = await fulfillNextVideoMemory();
    return Response.json({ processed });
  } catch (error) {
    return routeError(error, "Fulfillment tick failed.");
  }
}
