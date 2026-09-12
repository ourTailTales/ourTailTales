import { readExif } from "@/lib/photo/exif";
import {
  differenceHash,
  isUsable,
  orientationOf,
  qualityScore,
  toGrayscale,
  type QualitySample,
} from "@/lib/photo/quality";
import type { ProcessedPhoto } from "@/types/photo";

/** Retained browsing thumbnail: long edge in CSS pixels. */
export const BROWSE_THUMB_EDGE = 256;

/** Larger thumbnail generated on demand for the 3-5 AI representatives. */
export const AI_THUMB_EDGE = 448;

const HASH_WIDTH = 9;
const HASH_HEIGHT = 8;
const QUALITY_EDGE = 64;

/**
 * Fixed-size scratch canvases, reused across every photo so ingesting 2,000
 * files does not churn thousands of canvas allocations.
 */
let hashCanvas: OffscreenCanvas | null = null;
let qualityCanvas: OffscreenCanvas | null = null;

/**
 * Reads one photo and throws away everything large.
 *
 * Produces metadata, a tiny grayscale perceptual hash, a cheap quality score,
 * and a compressed ~256px browsing thumbnail. The decoded bitmap is closed
 * before returning, and the original file is never uploaded or modified.
 */
export async function processFile(
  id: string,
  file: File,
): Promise<ProcessedPhoto> {
  const exif = await readExif(file);

  let bitmap: ImageBitmap | null = null;
  try {
    bitmap = await createImageBitmap(file);

    const width = bitmap.width;
    const height = bitmap.height;

    const hashSample = sampleGrayscale(
      bitmap,
      getHashCanvas(),
      HASH_WIDTH,
      HASH_HEIGHT,
    );
    const dHash = differenceHash(hashSample);

    const qualitySample = sampleGrayscale(
      bitmap,
      getQualityCanvas(),
      QUALITY_EDGE,
      QUALITY_EDGE,
    );
    const score = qualityScore(qualitySample, width, height);

    const thumbBlob = await renderThumbnail(bitmap, BROWSE_THUMB_EDGE);

    const capturedAt = exif.capturedAt ?? fallbackDate(file);
    const dateSource = exif.capturedAt
      ? "exif"
      : capturedAt !== null
        ? "lastModified"
        : "unknown";

    return {
      id,
      fileName: file.name,
      fileSize: file.size,
      capturedAt,
      dateSource,
      lat: exif.lat,
      lng: exif.lng,
      width,
      height,
      orientation: orientationOf(width, height),
      qualityScore: score,
      dHash,
      fingerprint: `${file.size}:${width}x${height}:${capturedAt ?? "na"}`,
      usable: isUsable(width, height, score),
      thumbBlob,
    };
  } finally {
    bitmap?.close();
  }
}

export type Placement = {
  blob: Blob;
  width: number;
  height: number;
  /** Effective pixels-per-inch once placed, for low-resolution warnings. */
  ppi: number;
};

/**
 * Downsamples one original for one specific print placement.
 *
 * The output matches the slot's aspect ratio exactly via a centre crop, so the
 * PDF needs no clipping, and it is never upscaled past the original's real
 * resolution. Full-resolution originals are never embedded, and the decoded
 * bitmap and canvas are released before returning.
 */
export async function rasterizeForPlacement(
  file: File,
  slotWidthInches: number,
  slotHeightInches: number,
  targetPpi = 300,
  quality = 0.9,
): Promise<Placement> {
  let bitmap: ImageBitmap | null = null;
  let canvas: OffscreenCanvas | null = null;
  try {
    bitmap = await createImageBitmap(file);

    const wantWidth = Math.max(1, Math.round(slotWidthInches * targetPpi));
    const wantHeight = Math.max(1, Math.round(slotHeightInches * targetPpi));
    const slotAspect = wantWidth / wantHeight;

    // Centre-crop the source to the slot's aspect ratio.
    const sourceAspect = bitmap.width / bitmap.height;
    let cropWidth = bitmap.width;
    let cropHeight = bitmap.height;
    if (sourceAspect > slotAspect) {
      cropWidth = bitmap.height * slotAspect;
    } else {
      cropHeight = bitmap.width / slotAspect;
    }
    const cropX = (bitmap.width - cropWidth) / 2;
    const cropY = (bitmap.height - cropHeight) / 2;

    // Never invent detail: if the crop is smaller than the target, keep it.
    const shrink = Math.min(1, cropWidth / wantWidth);
    const width = Math.max(1, Math.round(wantWidth * shrink));
    const height = Math.max(1, Math.round(wantHeight * shrink));

    canvas = new OffscreenCanvas(width, height);
    const context = canvas.getContext("2d");
    if (!context) throw new Error("2D context unavailable");
    context.imageSmoothingQuality = "high";
    context.drawImage(
      bitmap,
      cropX,
      cropY,
      cropWidth,
      cropHeight,
      0,
      0,
      width,
      height,
    );

    const blob = await canvas.convertToBlob({ type: "image/jpeg", quality });
    return {
      blob,
      width,
      height,
      ppi: Math.round(width / slotWidthInches),
    };
  } finally {
    bitmap?.close();
    canvas = null;
  }
}

/** Generates a larger thumbnail on demand, then leaves it to the caller. */
export async function renderAiThumbnail(file: File): Promise<Blob> {
  let bitmap: ImageBitmap | null = null;
  try {
    bitmap = await createImageBitmap(file);
    return await renderThumbnail(bitmap, AI_THUMB_EDGE, 0.75);
  } finally {
    bitmap?.close();
  }
}

async function renderThumbnail(
  bitmap: ImageBitmap,
  longEdge: number,
  quality = 0.82,
): Promise<Blob> {
  const scale = Math.min(1, longEdge / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = new OffscreenCanvas(width, height);
  const context = canvas.getContext("2d");
  if (!context) throw new Error("2D context unavailable");
  context.drawImage(bitmap, 0, 0, width, height);

  try {
    return await canvas.convertToBlob({ type: "image/webp", quality });
  } catch {
    return await canvas.convertToBlob({ type: "image/jpeg", quality });
  }
}

function sampleGrayscale(
  bitmap: ImageBitmap,
  canvas: OffscreenCanvas,
  width: number,
  height: number,
): QualitySample {
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("2D context unavailable");
  context.clearRect(0, 0, width, height);
  context.drawImage(bitmap, 0, 0, width, height);
  const { data } = context.getImageData(0, 0, width, height);
  return { gray: toGrayscale(data, width * height), width, height };
}

function getHashCanvas(): OffscreenCanvas {
  hashCanvas ??= new OffscreenCanvas(HASH_WIDTH, HASH_HEIGHT);
  return hashCanvas;
}

function getQualityCanvas(): OffscreenCanvas {
  qualityCanvas ??= new OffscreenCanvas(QUALITY_EDGE, QUALITY_EDGE);
  return qualityCanvas;
}

function fallbackDate(file: File): number | null {
  return Number.isFinite(file.lastModified) && file.lastModified > 0
    ? file.lastModified
    : null;
}
