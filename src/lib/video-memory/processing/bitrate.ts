import {
  VIDEO_MEMORY_AUDIO_BITRATE,
  VIDEO_MEMORY_TARGET_PROCESSED_BYTES,
} from "@/lib/video-memory/config";

const MIN_VIDEO_BITRATE = 400_000;
const MAX_VIDEO_BITRATE = 4_500_000;

export function targetVideoBitrate(durationSeconds: number, targetBytes = VIDEO_MEMORY_TARGET_PROCESSED_BYTES): number {
  const seconds = Math.max(durationSeconds, 1);
  const targetTotalBitrate = (targetBytes * 8) / seconds;
  const video = targetTotalBitrate - VIDEO_MEMORY_AUDIO_BITRATE;
  return Math.round(clamp(video, MIN_VIDEO_BITRATE, MAX_VIDEO_BITRATE));
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
