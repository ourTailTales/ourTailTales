export type ProcessedVideoResult = {
  processedPath: string;
  processedBytes: number;
  durationMs: number;
  width: number;
  height: number;
  sha256: string;
  videoCodec: string;
  audioCodec?: string;
  thumbnailPath?: string;
};

export interface VideoProcessingProvider {
  processVideo(input: {
    sourcePath: string;
    assetId: string;
  }): Promise<ProcessedVideoResult>;
}
