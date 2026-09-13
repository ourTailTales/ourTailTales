import {
  DURATION_TOO_LONG_MESSAGE,
  VIDEO_MEMORIES_PER_PACK,
  VIDEO_MEMORY_MAX_DURATION_MS,
  VIDEO_MEMORY_PACK_PRICE_CENTS,
} from "@/lib/video-memory/config";
import { effectiveUploadLimitBytes } from "@/lib/video-memory/storage-limit";
import { routeError } from "@/lib/env";

export async function GET(): Promise<Response> {
  try {
    const limits = await effectiveUploadLimitBytes();
    return Response.json({
      maxDurationMs: VIDEO_MEMORY_MAX_DURATION_MS,
      maxSourceBytes: limits.effective,
      packSize: VIDEO_MEMORIES_PER_PACK,
      packPriceCents: VIDEO_MEMORY_PACK_PRICE_CENTS,
      durationTooLongMessage: DURATION_TOO_LONG_MESSAGE,
      storageInconsistent: limits.inconsistent,
    });
  } catch (error) {
    return routeError(error, "Video Memory settings could not be loaded.");
  }
}
