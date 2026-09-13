import { includedUniqueVideoIds } from "@/lib/video-memory/count";
import type { VideoAsset, VideoMemoryPlacement } from "@/types/video-memory";

/**
 * Unused library videos — including ones still processing — never block
 * checkout. Only unique placed memories must be ready to freeze.
 */
export function unusedLibraryBlocksCheckout(): boolean {
  return false;
}

export function placedMemoriesReadyForCheckout(
  placements: Pick<VideoMemoryPlacement, "videoAssetId">[],
  assets: Pick<VideoAsset, "id" | "status">[],
): boolean {
  const ids = includedUniqueVideoIds(placements);
  if (ids.length === 0) return true;
  const byId = new Map(assets.map((asset) => [asset.id, asset]));
  return ids.every((id) => byId.get(id)?.status === "ready");
}
