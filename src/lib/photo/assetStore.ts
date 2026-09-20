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
