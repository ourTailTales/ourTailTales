import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

import { requireEnv } from "@/lib/env";

/**
 * If VIDEO_MEMORY_WRAP_KEY is lost before QR generation, unprinted archived
 * videos may become unrecoverable. Printed QRs remain independent because they
 * carry playback capability.
 */
function masterKey(): Buffer {
  const [hex] = requireEnv("VIDEO_MEMORY_WRAP_KEY");
  const key = Buffer.from(hex, "hex");
  if (key.length !== 32) {
    throw new Error("VIDEO_MEMORY_WRAP_KEY must be 32 bytes of hex.");
  }
  return key;
}

export function generateAssetKey(): Buffer {
  return randomBytes(32);
}

export function wrapAssetKey(assetKey: Buffer): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", masterKey(), iv);
  const encrypted = Buffer.concat([cipher.update(assetKey), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString("base64url");
}

export function unwrapAssetKey(wrapped: string): Buffer {
  const raw = Buffer.from(wrapped, "base64url");
  const iv = raw.subarray(0, 12);
  const tag = raw.subarray(12, 28);
  const data = raw.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", masterKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]);
}

export function encryptVideo(plain: Buffer, assetKey: Buffer): Buffer {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", assetKey, iv);
  const encrypted = Buffer.concat([cipher.update(plain), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([Buffer.from("OTT1"), iv, tag, encrypted]);
}
