import { VIDEO_MEMORY_MAX_DURATION_MS } from "@/lib/video-memory/config";

export function isAcceptableVideoDuration(durationMs: number): boolean {
  return Number.isFinite(durationMs) && durationMs > 0 && durationMs <= VIDEO_MEMORY_MAX_DURATION_MS;
}

export function isAcceptableProcessedBytes(
  bytes: number,
  maxProcessedBytes: number,
): boolean {
  return Number.isFinite(bytes) && bytes > 0 && bytes <= maxProcessedBytes;
}
