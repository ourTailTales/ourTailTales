import type { VideoAsset } from "@/types/video-memory";

/** What a video is doing, in the customer's words. */
export function statusLabel(asset: Pick<VideoAsset, "status">): string {
  switch (asset.status) {
    case "uploaded":
      return "Uploading…";
    case "processing":
      return "Preparing video…";
    case "ready":
      return "Ready";
    case "failed":
      return "Processing failed";
  }
}
