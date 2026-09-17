import { readEnv } from "@/lib/env";

/** Product constraints — not environment-tunable. */
export const VIDEO_MEMORY_MAX_DURATION_MS = 60_000;
export const VIDEO_MEMORY_MAX_EDGE = 1920;
export const VIDEO_MEMORY_TARGET_HEIGHT = 1080;
export const VIDEO_MEMORY_MAX_FPS = 30;
export const VIDEO_MEMORY_AUDIO_BITRATE = 128_000;
export const VIDEO_MEMORY_TARGET_PROCESSED_BYTES = 30 * 1024 * 1024;
export const VIDEO_MEMORY_MAX_PROCESSED_BYTES = 40 * 1024 * 1024;
export const VIDEO_MEMORIES_PER_PACK = 10;
export const VIDEO_MEMORY_PACK_PRICE_CENTS = 999;
export const VIDEO_MEMORY_MAX_STORAGE_COST_RATIO = 0.50;
export const VIDEO_MEMORY_MIN_QR_INCHES = 1.25;
export const VIDEO_MEMORY_DEFAULT_QR_INCHES = 1.75;

const DEFAULT_MAX_SOURCE_BYTES = 500 * 1024 * 1024;
const DEFAULT_OPERATIONAL_MAX_ASSETS = 10_000;

export function parsePositiveInt(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return undefined;
  return parsed;
}

/**
 * Operational original-upload cap. 500 MB is the MVP default, not a
 * permanent-storage product rule. Processed output stays ≤ 40 MB.
 */
export function videoMemoryMaxSourceBytes(): number {
  return (
    parsePositiveInt(readEnv("VIDEO_MEMORY_MAX_SOURCE_BYTES")) ??
    DEFAULT_MAX_SOURCE_BYTES
  );
}

/**
 * Abuse/load safeguard only. Must never enter pack-pricing math or customer UI
 * as a product maximum.
 */
export function videoMemoryOperationalMaxAssetsPerDraft(): number {
  return (
    parsePositiveInt(readEnv("VIDEO_MEMORY_OPERATIONAL_MAX_ASSETS_PER_DRAFT")) ??
    DEFAULT_OPERATIONAL_MAX_ASSETS
  );
}

export function formatSourceLimitLabel(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  if (mb >= 1024) return `${(mb / 1024).toFixed(mb % 1024 === 0 ? 0 : 1)} GB`;
  return `${Math.round(mb)} MB`;
}

export const DURATION_TOO_LONG_MESSAGE =
  "Video Memories can be up to 1 minute long. Please choose a shorter clip.";

export function sourceTooLargeMessage(maxBytes: number): string {
  return `That video is larger than the ${formatSourceLimitLabel(maxBytes)} upload limit. Please choose a smaller file.`;
}

export const STORAGE_UNAVAILABLE_MESSAGE =
  "Video Memories are temporarily unavailable. Your book and videos have been saved.";

export const VIDEO_MEMORIES_PROCESSING_CUSTOMER =
  "We're preparing your Video Memories. Your book has not been sent to print yet.";

export const VIDEO_MEMORIES_STUCK_CUSTOMER =
  "We're having trouble preparing your book. Your order is safe and has not been sent to print.";
