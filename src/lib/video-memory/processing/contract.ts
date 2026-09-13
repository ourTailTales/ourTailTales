import {
  VIDEO_MEMORY_MAX_DURATION_MS,
  VIDEO_MEMORY_MAX_EDGE,
  VIDEO_MEMORY_MAX_PROCESSED_BYTES,
} from "@/lib/video-memory/config";
import type { ProcessedVideoResult } from "@/lib/video-memory/processing/types";

const ALLOWED_VIDEO = new Set(["h264", "avc1", "avc"]);
const ALLOWED_AUDIO = new Set(["aac", "mp4a"]);

export function assertProcessedContract(
  result: ProcessedVideoResult,
  maxProcessedBytes = VIDEO_MEMORY_MAX_PROCESSED_BYTES,
): void {
  if (result.durationMs > VIDEO_MEMORY_MAX_DURATION_MS) {
    throw new Error("Processed video is longer than 1 minute.");
  }
  if (result.width > VIDEO_MEMORY_MAX_EDGE || result.height > VIDEO_MEMORY_MAX_EDGE) {
    throw new Error("Processed video exceeds 1920×1080.");
  }
  if (result.processedBytes > maxProcessedBytes) {
    throw new Error("Processed video exceeds the permanent storage budget.");
  }
  const videoCodec = result.videoCodec.toLowerCase();
  if (![...ALLOWED_VIDEO].some((name) => videoCodec.includes(name))) {
    throw new Error("Processed video must be H.264.");
  }
  if (result.audioCodec) {
    const audioCodec = result.audioCodec.toLowerCase();
    if (![...ALLOWED_AUDIO].some((name) => audioCodec.includes(name))) {
      throw new Error("Processed audio must be AAC.");
    }
  }
}

export function canEnterPermanentArchival(
  processedBytes: number,
  maxProcessedBytes = VIDEO_MEMORY_MAX_PROCESSED_BYTES,
): boolean {
  return processedBytes > 0 && processedBytes <= maxProcessedBytes;
}
