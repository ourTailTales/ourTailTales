import { PDFDocument } from "pdf-lib";

import {
  uploadEncryptedBytes,
  verifyPermanentAsset,
} from "@/lib/archival/turbo";
import {
  encryptVideo,
  generateAssetKey,
  unwrapAssetKey,
  wrapAssetKey,
} from "@/lib/archival/encrypt";
import {
  assertPrintableQr,
  generateQrPng,
  playbackUrl,
  validateQrPlacement,
} from "@/lib/archival/qr";
import { stampQrCodes } from "@/lib/archival/stamp";
import { mayStartArchival, videosEligibleForArchival } from "@/lib/archival/can-archive";
import { STORAGE_BUCKET, supabaseAdmin } from "@/lib/supabase/server";
import { markNeedsReview, submitPaidOrderToLulu } from "@/lib/order/submit-print";
import type { FrozenBookRevision } from "@/types/video-memory";
import { readEnv } from "@/lib/env";

const MAX_ATTEMPTS = 6;

export async function fulfillNextVideoMemory(): Promise<string | null> {
  const supabase = supabaseAdmin();
  const now = new Date().toISOString();

  const { data: candidates, error } = await supabase
    .from("order_video_memories")
    .select("id, order_id, processed_path, wrapped_key, arweave_tx_id, attempt_count")
    .in("status", ["pending", "failed"])
    .is("arweave_tx_id", null)
    .lt("attempt_count", MAX_ATTEMPTS)
    .or(`next_retry_at.is.null,next_retry_at.lte.${now}`)
    .order("created_at", { ascending: true })
    .limit(1);

  if (error) throw new Error(error.message);
  const candidate = candidates?.[0];
  if (!candidate) {
    await maybeFinishOrders();
    return null;
  }

  const { data: order } = await supabase
    .from("orders")
    .select("id, status, fulfillment_stage, archival_consent_at, book_snapshot")
    .eq("id", candidate.order_id)
    .maybeSingle();

  if (
    !order ||
    !mayStartArchival({
      orderStatus: order.status,
      fulfillmentStage: order.fulfillment_stage,
      consentAt: order.archival_consent_at,
    })
  ) {
    return null;
  }

  const { data: claimed } = await supabase
    .from("order_video_memories")
    .update({
      status: "archiving",
      attempt_count: candidate.attempt_count + 1,
    })
    .eq("id", candidate.id)
    .is("arweave_tx_id", null)
    .in("status", ["pending", "failed"])
    .select("id, processed_path, wrapped_key")
    .maybeSingle();

  if (!claimed) return null;

  await supabase
    .from("orders")
    .update({ fulfillment_stage: "archiving" })
    .eq("id", order.id);

  try {
    const { data: file, error: downloadError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .download(claimed.processed_path);
    if (downloadError || !file) throw new Error("processed_missing");

    const plain = Buffer.from(await file.arrayBuffer());
    const assetKey = claimed.wrapped_key
      ? unwrapAssetKey(claimed.wrapped_key)
      : generateAssetKey();
    const wrapped = claimed.wrapped_key ?? wrapAssetKey(assetKey);
    const encrypted = encryptVideo(plain, assetKey);
    const { txId } = await uploadEncryptedBytes(encrypted);
    const ok = await verifyPermanentAsset(txId);
    if (!ok) throw new Error("turbo_upload_unverified");

    await supabase
      .from("order_video_memories")
      .update({
        status: "verified",
        wrapped_key: wrapped,
        arweave_tx_id: txId,
        viewer_tx_id: readEnv("ARWEAVE_PLAYER_TX") ?? null,
        encrypted_bytes: encrypted.byteLength,
        archived_at: new Date().toISOString(),
        error_code: null,
      })
      .eq("id", claimed.id);

    await maybeFinishOrders();
    return claimed.id;
  } catch (error) {
    const attempts = candidate.attempt_count + 1;
    const delay = Math.min(30 * 60, 2 ** attempts * 30) * 1000;
    const code = error instanceof Error ? error.message : "archive_failed";
    await supabase
      .from("order_video_memories")
      .update({
        status: "failed",
        error_code: safeErrorCode(code),
        next_retry_at: new Date(Date.now() + delay).toISOString(),
      })
      .eq("id", claimed.id);

    if (attempts >= MAX_ATTEMPTS) {
      await markNeedsReview(order.id, "video_memory_prepare_failed");
      await supabase
        .from("orders")
        .update({ fulfill_error_code: "video_memory_prepare_failed" })
        .eq("id", order.id);
    }
    console.error("[ourTailTales] archival failed", claimed.id, safeErrorCode(code));
    return claimed.id;
  }
}

async function maybeFinishOrders(): Promise<void> {
  const supabase = supabaseAdmin();
  const { data: orders } = await supabase
    .from("orders")
    .select("id, book_snapshot, frozen_interior_path, cover_path")
    .eq("status", "paid")
    .in("fulfillment_stage", ["archiving", "pending_archive", "archived"]);

  for (const order of orders ?? []) {
    const { data: memories } = await supabase
      .from("order_video_memories")
      .select("id, video_asset_id, status, arweave_tx_id, wrapped_key, viewer_tx_id")
      .eq("order_id", order.id);

    if (!memories?.length) continue;
    if (memories.some((memory) => memory.status !== "verified" || !memory.arweave_tx_id)) {
      continue;
    }

    try {
      await supabase
        .from("orders")
        .update({ fulfillment_stage: "preparing_print" })
        .eq("id", order.id);

      const revision = order.book_snapshot as FrozenBookRevision;
      const eligible = videosEligibleForArchival(revision);
      if (eligible.length !== memories.length) {
        throw new Error("revision_mismatch");
      }

      const qrByAssetId = new Map<string, Uint8Array>();
      for (const memory of memories) {
        if (!memory.arweave_tx_id || !memory.wrapped_key) {
          throw new Error("qr_missing_key");
        }
        const key = unwrapAssetKey(memory.wrapped_key).toString("base64url");
        const url = playbackUrl({
          videoTx: memory.arweave_tx_id,
          key,
        });
        const png = await generateQrPng(url);
        const boxes = revision.placements.filter(
          (placement) => placement.videoAssetId === memory.video_asset_id,
        );
        for (const box of boxes) {
          validateQrPlacement(box);
          await assertPrintableQr(png, url, box);
        }
        qrByAssetId.set(memory.video_asset_id, new Uint8Array(png));
      }

      if (!order.frozen_interior_path) throw new Error("frozen_pdf_missing");
      const { data: frozen } = await supabase.storage
        .from(STORAGE_BUCKET)
        .download(order.frozen_interior_path);
      if (!frozen) throw new Error("frozen_pdf_missing");

      const stamped = await stampQrCodes({
        frozenPdf: new Uint8Array(await frozen.arrayBuffer()),
        placements: revision.placements,
        qrByAssetId,
        pageNumberById: new Map(
          revision.pages.map((page) => [page.id, page.pageNumber]),
        ),
      });

      const interiorPath = `orders/${order.id}/interior.pdf`;
      const { error: uploadError } = await supabase.storage
        .from(STORAGE_BUCKET)
        .upload(interiorPath, stamped, { contentType: "application/pdf", upsert: true });
      if (uploadError) throw new Error(uploadError.message);

      await PDFDocument.load(stamped);

      await supabase
        .from("orders")
        .update({
          interior_path: interiorPath,
          fulfillment_stage: "archived",
        })
        .eq("id", order.id);

      await submitPaidOrderToLulu(order.id);
    } catch (error) {
      const code = error instanceof Error ? error.message : "print_prepare_failed";
      console.error("[ourTailTales] print prepare failed", order.id, safeErrorCode(code));
      await markNeedsReview(order.id, "video_memory_prepare_failed");
    }
  }
}

function safeErrorCode(code: string): string {
  const allowed = new Set([
    "processed_missing",
    "turbo_not_configured",
    "turbo_upload_unverified",
    "storage_price_unavailable",
    "qr_decode_mismatch",
    "qr_below_min_size",
    "qr_out_of_bounds",
    "qr_missing_for_placement",
    "frozen_pdf_missing",
    "revision_mismatch",
    "archive_failed",
    "print_prepare_failed",
    "video_memory_prepare_failed",
  ]);
  return allowed.has(code) ? code : "archive_failed";
}
