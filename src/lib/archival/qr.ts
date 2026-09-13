import QRCode from "qrcode";
import jsQR from "jsqr";
import { PNG } from "pngjs";

import { PAGE_INCHES } from "@/lib/book/layouts";
import { VIDEO_MEMORY_MIN_QR_INCHES } from "@/lib/video-memory/config";
import {
  isInsidePage,
  meetsMinimumQrSize,
  type NormalizedBox,
} from "@/lib/video-memory/geometry";
import { readEnv } from "@/lib/env";

export type PlaybackPayload = {
  videoTx: string;
  key: string;
};

export function playbackUrl(payload: PlaybackPayload): string {
  const player = readEnv("ARWEAVE_PLAYER_TX") ?? "player";
  return `https://arweave.net/${player}#v=${payload.videoTx}&k=${payload.key}`;
}

export async function generateQrPng(url: string): Promise<Buffer> {
  return QRCode.toBuffer(url, {
    type: "png",
    errorCorrectionLevel: "H",
    margin: 4,
    width: 512,
  });
}

export async function decodeQrPng(png: Buffer): Promise<string | null> {
  const image = PNG.sync.read(png);
  const decoded = jsQR(
    new Uint8ClampedArray(image.data),
    image.width,
    image.height,
  );
  return decoded?.data ?? null;
}

export function validateQrPlacement(box: NormalizedBox): void {
  if (!isInsidePage(box)) {
    throw new Error("qr_out_of_bounds");
  }
  if (!meetsMinimumQrSize(box)) {
    throw new Error("qr_below_min_size");
  }
  const inches = Math.min(box.width, box.height) * PAGE_INCHES;
  if (inches < VIDEO_MEMORY_MIN_QR_INCHES) {
    throw new Error("qr_below_min_size");
  }
}

export async function assertPrintableQr(
  png: Buffer,
  expectedUrl: string,
  box: NormalizedBox,
): Promise<void> {
  validateQrPlacement(box);
  const decoded = await decodeQrPng(png);
  if (!decoded || decoded !== expectedUrl) {
    throw new Error("qr_decode_mismatch");
  }
}
