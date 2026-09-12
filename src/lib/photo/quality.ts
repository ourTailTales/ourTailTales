/**
 * Cheap image-quality heuristics. These run on small grayscale samples, never
 * on full-resolution pixel data.
 */

/** Longest edge below this cannot hold up on an 8.5 in page. */
export const MIN_USABLE_EDGE = 640;

export type QualitySample = {
  /** Grayscale bytes, row-major. */
  gray: Uint8Array;
  width: number;
  height: number;
};

export function toGrayscale(data: Uint8ClampedArray, pixels: number): Uint8Array {
  const gray = new Uint8Array(pixels);
  for (let i = 0; i < pixels; i += 1) {
    const offset = i * 4;
    gray[i] =
      (data[offset] * 299 + data[offset + 1] * 587 + data[offset + 2] * 114) /
      1000;
  }
  return gray;
}

/**
 * 64-bit difference hash as 16 hex characters. Computed from a 9x8 grayscale
 * render — the smallest image that carries a usable fingerprint.
 */
export function differenceHash(sample: QualitySample): string {
  const { gray, width, height } = sample;
  let hex = "";
  let nibble = 0;
  let bits = 0;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width - 1; x += 1) {
      const left = gray[y * width + x];
      const right = gray[y * width + x + 1];
      nibble = (nibble << 1) | (left > right ? 1 : 0);
      bits += 1;
      if (bits === 4) {
        hex += nibble.toString(16);
        nibble = 0;
        bits = 0;
      }
    }
  }

  return hex;
}

/**
 * Blends resolution, exposure clipping, and edge energy into a 0..1 score.
 * Weak images are flagged, never deleted.
 */
export function qualityScore(
  sample: QualitySample,
  sourceWidth: number,
  sourceHeight: number,
): number {
  const resolution = Math.min(1, (sourceWidth * sourceHeight) / 2_500_000);
  const exposure = 1 - clippedFraction(sample.gray);
  const sharpness = edgeEnergy(sample);

  const score = resolution * 0.3 + exposure * 0.3 + sharpness * 0.4;
  return Math.min(1, Math.max(0, score));
}

function clippedFraction(gray: Uint8Array): number {
  let clipped = 0;
  for (let i = 0; i < gray.length; i += 1) {
    if (gray[i] < 8 || gray[i] > 247) clipped += 1;
  }
  return gray.length === 0 ? 1 : clipped / gray.length;
}

/** Mean gradient magnitude, normalized into roughly 0..1. */
function edgeEnergy(sample: QualitySample): number {
  const { gray, width, height } = sample;
  if (width < 3 || height < 3) return 0.5;

  let total = 0;
  let count = 0;
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const i = y * width + x;
      const dx = Math.abs(gray[i - 1] - gray[i + 1]);
      const dy = Math.abs(gray[i - width] - gray[i + width]);
      total += dx + dy;
      count += 1;
    }
  }

  const mean = count === 0 ? 0 : total / count;
  return Math.min(1, mean / 48);
}

export function isUsable(
  width: number,
  height: number,
  score: number,
): boolean {
  return Math.max(width, height) >= MIN_USABLE_EDGE && score > 0.12;
}

export function orientationOf(
  width: number,
  height: number,
): "portrait" | "landscape" | "square" {
  const ratio = width / height;
  if (ratio > 1.05) return "landscape";
  if (ratio < 0.95) return "portrait";
  return "square";
}
