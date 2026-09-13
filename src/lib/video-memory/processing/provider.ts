import type { VideoProcessingProvider } from "@/lib/video-memory/processing/types";
import { LocalFfmpegVideoProcessor } from "@/lib/video-memory/processing/local-ffmpeg";

let cached: VideoProcessingProvider | null = null;

/**
 * FFmpeg lives only behind this factory. Route handlers must not import
 * LocalFfmpegVideoProcessor or spawn ffmpeg themselves.
 */
export function videoProcessingProvider(): VideoProcessingProvider {
  cached ??= new LocalFfmpegVideoProcessor();
  return cached;
}
