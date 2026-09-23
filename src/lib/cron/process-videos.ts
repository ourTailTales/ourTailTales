import {
  processNextVideoAsset,
  recoverStaleProcessing,
} from "@/lib/video-memory/process-job";

/**
 * Extracted from the route handler so the daily dispatcher can call it
 * directly, without a second HTTP hop or a second cold start.
 */
export async function processVideos(): Promise<Record<string, unknown>> {
  const recovered = await recoverStaleProcessing();
  const processed = await processNextVideoAsset();

  return { recovered, processed };
}
