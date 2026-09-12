export type DateSource = "exif" | "lastModified" | "unknown";

export type Orientation = "portrait" | "landscape" | "square";

/**
 * Session-only metadata for one selected photo.
 *
 * Binary data is deliberately absent: the original `File` handle and the
 * browsing thumbnail Blob live in the module-level asset store
 * (`src/lib/photo/assetStore.ts`), keyed by `id`. Only `thumbUrl` (an object
 * URL string) crosses into React render state.
 */
export type PhotoAsset = {
  id: string;
  fileName: string;
  fileSize: number;
  /** Epoch ms, or null when neither EXIF nor lastModified produced a date. */
  capturedAt: number | null;
  dateSource: DateSource;
  lat?: number;
  lng?: number;
  width: number;
  height: number;
  orientation: Orientation;
  /** 0..1, cheap resolution/exposure/sharpness estimate. */
  qualityScore: number;
  /** 64-bit perceptual hash as hex, from a tiny grayscale render. */
  dHash: string;
  /** size + dimensions + capturedAt, for exact-ish duplicate grouping. */
  fingerprint: string;
  duplicateGroupId?: string;
  /** True for non-representative members of a duplicate group. */
  isDuplicate: boolean;
  /** False for images too small or too degraded to place; still restorable. */
  usable: boolean;
  thumbUrl: string;
};

/** Worker -> main thread message for a single processed file. */
export type ProcessedPhoto = {
  id: string;
  fileName: string;
  fileSize: number;
  capturedAt: number | null;
  dateSource: DateSource;
  lat?: number;
  lng?: number;
  width: number;
  height: number;
  orientation: Orientation;
  qualityScore: number;
  dHash: string;
  fingerprint: string;
  usable: boolean;
  thumbBlob: Blob;
};

export type ProcessingPhase =
  | "reading"
  | "thumbnails"
  | "deduplicating"
  | "sorting"
  | "done";

export type ProcessingProgressState = {
  processed: number;
  total: number;
  phase: ProcessingPhase;
  failed: number;
};
