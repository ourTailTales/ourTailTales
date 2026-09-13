export type VideoAssetStatus =
  | "uploaded"
  | "processing"
  | "ready"
  | "failed";

export type VideoAsset = {
  id: string;
  draftId: string;
  title: string;
  originalPath: string;
  processedPath: string | null;
  thumbnailPath: string | null;
  previewUrl?: string | null;
  durationMs: number | null;
  originalBytes: number;
  processedBytes: number | null;
  processedWidth: number | null;
  processedHeight: number | null;
  contentSha256: string | null;
  status: VideoAssetStatus;
  processingErrorCode: string | null;
  createdAt: string;
  updatedAt: string;
};

export type VideoMemoryPlacement = {
  id: string;
  type: "video-memory";
  videoAssetId: string;
  pageId: string;
  title?: string;
  caption?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  zIndex?: number;
};

export type FrozenProcessedVideo = {
  videoAssetId: string;
  processedPath: string;
  processedBytes: number;
  contentSha256: string;
  durationMs: number;
  width: number;
  height: number;
};

export type FrozenBookRevision = {
  pages: { id: string; pageNumber: number; kind: string }[];
  placements: VideoMemoryPlacement[];
  processedVideos: FrozenProcessedVideo[];
};

export type FulfillmentStage =
  | "pending_payment"
  | "paid"
  | "pending_archive"
  | "archiving"
  | "archived"
  | "preparing_print"
  | "submitted"
  | "canceled";
