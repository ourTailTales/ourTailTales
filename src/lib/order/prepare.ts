import { renderCoverPdf } from "@/lib/book/cover-pdf";
import { renderInteriorPdf } from "@/lib/book/interior-pdf";
import { luluInteriorPages } from "@/lib/pricing";
import type { BookMeta, BookPage, Chapter } from "@/types/book";
import type { PhotoAsset } from "@/types/photo";

export type PreparedOrder = {
  orderId: string;
  totalPages: number;
  lowResPlacements: number;
};

type SignedUpload = { path: string; signedUrl: string };

/**
 * Turns the on-screen book into the two print files Lulu needs, then hands them
 * to Supabase through short-lived signed upload URLs.
 *
 * Runs entirely in the browser: originals never leave the device except as the
 * downsampled placements baked into the PDFs.
 */
export async function prepareOrder(args: {
  meta: BookMeta;
  chapters: Chapter[];
  pages: BookPage[];
  chapterCount: number;
  photos: Map<string, PhotoAsset>;
  email: string | null;
  onStatus: (message: string) => void;
}): Promise<PreparedOrder> {
  const totalPages = luluInteriorPages(args.chapterCount);

  args.onStatus("Setting up your order…");
  const order = await postJson<{ orderId: string }>("/api/orders", {
    petName: args.meta.petName,
    chapterCount: args.chapterCount,
    email: args.email,
  });

  args.onStatus(`Laying out ${totalPages} print pages — this can take a minute…`);
  const interior = await renderInteriorPdf({
    pages: args.pages,
    chapters: args.chapters,
    meta: args.meta,
    photos: args.photos,
    targetPpi: 300,
    onProgress: (done, total) =>
      args.onStatus(`Rendering page ${done} of ${total} at print resolution…`),
  });

  if (interior.lowResWarnings.length > 0) {
    console.warn(
      `[ourTailTales] ${interior.lowResWarnings.length} placement(s) below print resolution`,
      interior.lowResWarnings,
    );
  }

  args.onStatus("Measuring your cover…");
  const dimensions = await postJson<{ width: number; height: number }>(
    "/api/lulu/cover-dimensions",
    { pageCount: totalPages },
  );

  args.onStatus("Printing the cover artwork…");
  const cover = await renderCoverPdf({
    meta: args.meta,
    dimensions,
    targetPpi: 300,
  });

  args.onStatus("Uploading your print files…");
  const uploads = await postJson<{
    interior: SignedUpload;
    cover: SignedUpload;
  }>("/api/order-assets", { orderId: order.orderId });

  const interiorBlob = new Blob([interior.bytes as unknown as BlobPart], {
    type: "application/pdf",
  });

  await Promise.all([
    upload(uploads.interior.signedUrl, interiorBlob),
    upload(uploads.cover.signedUrl, cover),
  ]);

  return {
    orderId: order.orderId,
    totalPages,
    lowResPlacements: interior.lowResWarnings.length,
  };
}

async function upload(signedUrl: string, blob: Blob): Promise<void> {
  const response = await fetch(signedUrl, {
    method: "PUT",
    headers: { "Content-Type": "application/pdf", "x-upsert": "true" },
    body: blob,
  });
  if (!response.ok) {
    throw new Error(
      "Your print files could not be uploaded. Please try again in a moment.",
    );
  }
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    let message = `Request to ${url} failed (${response.status}).`;
    try {
      const data = (await response.json()) as { error?: string };
      if (data.error) message = data.error;
    } catch {
      // Keep the status-based message.
    }
    throw new Error(message);
  }

  return (await response.json()) as T;
}
