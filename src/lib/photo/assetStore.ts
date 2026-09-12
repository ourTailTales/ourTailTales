/**
 * Module-level store for photo binaries, deliberately outside React and
 * Zustand state.
 *
 * The original `File` is only a handle to the user's local file; it is never
 * uploaded during album analysis. Browsing thumbnails are ~200-256px
 * compressed Blobs. React only ever sees the object URL string.
 */

type AssetEntry = {
  file: File;
  thumbBlob: Blob;
  thumbUrl: string;
};

const assets = new Map<string, AssetEntry>();

export function putAsset(id: string, file: File, thumbBlob: Blob): string {
  releaseAsset(id);
  const thumbUrl = URL.createObjectURL(thumbBlob);
  assets.set(id, { file, thumbBlob, thumbUrl });
  return thumbUrl;
}

export function getFile(id: string): File | undefined {
  return assets.get(id)?.file;
}

export function getThumbBlob(id: string): Blob | undefined {
  return assets.get(id)?.thumbBlob;
}

export function getThumbUrl(id: string): string | undefined {
  return assets.get(id)?.thumbUrl;
}

export function hasAsset(id: string): boolean {
  return assets.has(id);
}

export function assetCount(): number {
  return assets.size;
}

export function releaseAsset(id: string): void {
  const entry = assets.get(id);
  if (!entry) return;
  URL.revokeObjectURL(entry.thumbUrl);
  assets.delete(id);
}

export function releaseAll(): void {
  for (const entry of assets.values()) {
    URL.revokeObjectURL(entry.thumbUrl);
  }
  assets.clear();
}

/** Drop anything not referenced by the current album. */
export function retainOnly(ids: Iterable<string>): void {
  const keep = new Set(ids);
  for (const id of [...assets.keys()]) {
    if (!keep.has(id)) releaseAsset(id);
  }
}
