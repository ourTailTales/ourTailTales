import { PAGE_INCHES, SAFE_INCHES } from "@/lib/book/layouts";
import {
  VIDEO_MEMORY_DEFAULT_QR_INCHES,
  VIDEO_MEMORY_MIN_QR_INCHES,
} from "@/lib/video-memory/config";

export type NormalizedBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export function defaultVideoMemoryBox(): NormalizedBox {
  const size = VIDEO_MEMORY_DEFAULT_QR_INCHES / PAGE_INCHES;
  const margin = SAFE_INCHES / PAGE_INCHES;
  return {
    x: 1 - margin - size,
    y: 1 - margin - size,
    width: size,
    height: size,
  };
}

export function inchesFromNormalized(size: number): number {
  return size * PAGE_INCHES;
}

export function meetsMinimumQrSize(box: NormalizedBox): boolean {
  const inches = Math.min(inchesFromNormalized(box.width), inchesFromNormalized(box.height));
  return inches + 1e-6 >= VIDEO_MEMORY_MIN_QR_INCHES;
}

export function isInsidePage(box: NormalizedBox): boolean {
  return (
    box.x >= 0 &&
    box.y >= 0 &&
    box.width > 0 &&
    box.height > 0 &&
    box.x + box.width <= 1 + 1e-6 &&
    box.y + box.height <= 1 + 1e-6
  );
}
