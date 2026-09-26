import type { VideoMemoryPlacement } from "@/types/video-memory";

/** Unique video assets referenced by at least one active placement. */
export function includedUniqueVideoIds(
  placements: Pick<VideoMemoryPlacement, "videoAssetId">[],
): string[] {
  return [...new Set(placements.map((placement) => placement.videoAssetId))];
}

export function includedUniqueVideoCount(
  placements: Pick<VideoMemoryPlacement, "videoAssetId">[],
): number {
  return includedUniqueVideoIds(placements).length;
}

export function placementsForAsset(
  placements: VideoMemoryPlacement[],
  videoAssetId: string,
): VideoMemoryPlacement[] {
  return placements.filter((placement) => placement.videoAssetId === videoAssetId);
}
