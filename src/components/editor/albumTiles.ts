import type { AlbumVideoPreview } from "@/store/useOurTailTalesStore";
import { MIN_USABLE_EDGE } from "@/lib/photo/quality";
import type { PhotoAsset } from "@/types/photo";

export type AlbumTile = {
  id: string;
  thumbUrl: string;
  kind: "photo" | "video";
  previewUrl?: string;
  /** Epoch ms when known; null sorts after dated items. */
  capturedAt: number | null;
  label?: string;
  usable?: boolean;
  isDuplicate?: boolean;
  width?: number;
  height?: number;
};

export type PhotoPrintStatus = "ready" | "duplicate" | "unusable";
export type PrintIssue = "small" | "quality";

export function albumTilesFrom(
  photos: PhotoAsset[],
  videos: AlbumVideoPreview[],
): AlbumTile[] {
  const photoTiles = photos
    .filter((photo) => photo.thumbUrl)
    .map((photo) => ({
      id: photo.id,
      thumbUrl: photo.thumbUrl,
      kind: "photo" as const,
      capturedAt: photo.capturedAt,
      usable: photo.usable,
      isDuplicate: photo.isDuplicate,
      width: photo.width,
      height: photo.height,
    }));
  const videoTiles = videos.map((video) => ({
    id: video.id,
    thumbUrl: video.posterUrl,
    previewUrl: video.previewUrl,
    kind: "video" as const,
    capturedAt: null as number | null,
    label: video.fileName,
  }));
  return [...photoTiles, ...videoTiles];
}

export function photoPrintStatus(tile: AlbumTile): PhotoPrintStatus | null {
  if (tile.kind !== "photo") return null;
  if (tile.usable === false) return "unusable";
  if (tile.isDuplicate) return "duplicate";
  return "ready";
}

/** Why a photo failed the print gate — GPS is not part of this check. */
export function printIssue(tile: AlbumTile): PrintIssue | null {
  if (tile.kind !== "photo" || tile.usable !== false) return null;
  const edge = Math.max(tile.width ?? 0, tile.height ?? 0);
  if (edge < MIN_USABLE_EDGE) return "small";
  return "quality";
}

export function splitPhotoTiles(photos: AlbumTile[]): {
  main: AlbumTile[];
  duplicates: AlbumTile[];
  unusable: AlbumTile[];
} {
  const main: AlbumTile[] = [];
  const duplicates: AlbumTile[] = [];
  const unusable: AlbumTile[] = [];
  for (const tile of photos) {
    if (tile.usable === false) unusable.push(tile);
    else if (tile.isDuplicate) duplicates.push(tile);
    else main.push(tile);
  }
  return { main, duplicates, unusable };
}

/** Photos first group, videos second — each chronological (oldest → newest). */
export function partitionAlbumChronologically(tiles: AlbumTile[]): {
  photos: AlbumTile[];
  videos: AlbumTile[];
} {
  return {
    photos: sortChronological(tiles.filter((tile) => tile.kind === "photo")),
    videos: sortChronological(tiles.filter((tile) => tile.kind === "video")),
  };
}

function sortChronological(tiles: AlbumTile[]): AlbumTile[] {
  return [...tiles].sort((a, b) => {
    const aTime = a.capturedAt ?? Number.POSITIVE_INFINITY;
    const bTime = b.capturedAt ?? Number.POSITIVE_INFINITY;
    if (aTime !== bTime) return aTime - bTime;
    return (a.label ?? a.id).localeCompare(b.label ?? b.id);
  });
}
