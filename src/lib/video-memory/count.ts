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

export function pageNumbersForAsset(
  placements: VideoMemoryPlacement[],
  pages: { id: string; pageNumber: number }[],
  videoAssetId: string,
): number[] {
  const pageById = new Map(pages.map((page) => [page.id, page.pageNumber]));
  return placementsForAsset(placements, videoAssetId)
    .map((placement) => pageById.get(placement.pageId))
    .filter((value): value is number => typeof value === "number")
    .sort((a, b) => a - b);
}
