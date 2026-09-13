/**
 * Turbo/Arweave access. Import only from the fulfill worker — never from
 * upload, process-complete, preview, sample PDF, or the Stripe webhook.
 */

import { Readable } from "node:stream";

import { readEnv } from "@/lib/env";

export type TurboCostEstimate = {
  bytes: number;
  costUsd: number;
};

export async function estimatePermanentStorageCost(
  bytes: number,
): Promise<TurboCostEstimate> {
  const response = await fetch(
    `https://payment.ardrive.io/v1/price/bytes/${Math.max(1, Math.floor(bytes))}`,
  );
  if (!response.ok) {
    throw new Error("storage_price_unavailable");
  }
  const data = (await response.json()) as { winc?: string; usd?: number };
  const costUsd =
    typeof data.usd === "number"
      ? data.usd
      : Number(data.winc ?? 0) / 1e12;
  if (!Number.isFinite(costUsd)) {
    throw new Error("storage_price_unavailable");
  }
  return { bytes, costUsd };
}

export async function uploadEncryptedBytes(
  encrypted: Buffer,
): Promise<{ txId: string }> {
  const { TurboFactory } = await import("@ardrive/turbo-sdk");
  const paymentKey = readEnv("TURBO_PAYMENT_KEY");
  const jwkRaw = readEnv("ARWEAVE_JWK") ?? paymentKey;
  if (!jwkRaw) {
    throw new Error("turbo_not_configured");
  }

  let privateKey: unknown = jwkRaw;
  try {
    privateKey = JSON.parse(jwkRaw);
  } catch {
    // Treat a non-JSON secret as a raw wallet payload.
  }

  const turbo = TurboFactory.authenticated({
    privateKey: privateKey as never,
  });

  const result = await turbo.uploadFile({
    fileStreamFactory: () => Readable.from(encrypted),
    fileSizeFactory: () => encrypted.byteLength,
    dataItemOpts: {
      tags: [
        { name: "Content-Type", value: "application/octet-stream" },
        { name: "App-Name", value: "OurTailTales" },
      ],
    },
  });

  const txId = (result as { id?: string }).id;
  if (!txId) throw new Error("turbo_upload_unverified");
  return { txId };
}

export async function verifyPermanentAsset(txId: string): Promise<boolean> {
  const response = await fetch(`https://arweave.net/${txId}`, { method: "HEAD" });
  return response.ok;
}
