import { bookUrl } from "@/lib/drafts/storage";
import { draftHeaders, ensureDraft } from "@/lib/video-memory/client";

/**
 * Banks the free preview PDF and returns the link that opens it.
 *
 * The bytes go straight from the browser to private storage through a scoped,
 * expiring URL — the same route print files take — because a full book at
 * preview resolution is comfortably larger than a route handler's request body
 * cap. The server then watermarks what landed and stamps the 30-day clock.
 */
export async function uploadFreePreview(args: {
  pdf: Blob;
  petName: string;
  chapterCount: number;
}): Promise<{ draftId: string; url: string; expiresAt: string | null }> {
  const draft = await ensureDraft();
  const headers = draftHeaders(draft.draftId, draft.secret);

  const signResponse = await fetch("/api/drafts/upload-pdf", {
    method: "POST",
    headers,
  });
  const signed = (await signResponse.json().catch(() => ({}))) as {
    signedUrl?: string;
    error?: string;
  };
  if (!signResponse.ok || !signed.signedUrl) {
    throw new Error(signed.error ?? "Your book could not be saved.");
  }

  const upload = await fetch(signed.signedUrl, {
    method: "PUT",
    headers: { "Content-Type": "application/pdf", "x-upsert": "true" },
    body: args.pdf,
  });
  if (!upload.ok) throw new Error("Your book could not be uploaded.");

  const finalizeResponse = await fetch("/api/drafts/upload-pdf", {
    method: "PUT",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({
      petName: args.petName,
      chapterCount: args.chapterCount,
    }),
  });
  const finalized = (await finalizeResponse.json().catch(() => ({}))) as {
    expiresAt?: string | null;
    error?: string;
  };
  if (!finalizeResponse.ok) {
    throw new Error(finalized.error ?? "Your book could not be saved.");
  }

  return {
    draftId: draft.draftId,
    url: bookUrl(draft.draftId, draft.secret),
    expiresAt: finalized.expiresAt ?? null,
  };
}
