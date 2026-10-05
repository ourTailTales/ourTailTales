import { bookUrl, claimUrl, type DraftBankKind } from "@/lib/drafts/storage";
import {
  draftHeaders,
  ensureDraft,
  replaceStoredDraft,
  type StoredDraft,
} from "@/lib/video-memory/client";

export type BankedBook = {
  draftId: string;
  secret: string;
  /** Opens the book in a browser. */
  url: string;
  /** Opens the make-an-account page for this book. */
  claim: string;
  expiresAt: string | null;
};

/**
 * Banks a rendered book and returns the links that reopen it.
 *
 * The bytes go straight from the browser to private storage through a scoped,
 * expiring URL — the same route print files take — because a book at preview
 * resolution is comfortably larger than a route handler's request body cap.
 *
 * `kind` decides which book this is. The teaser is banked the moment the story
 * is written, so the welcome email has something to attach; the full book is
 * banked once there is an account to attach it to, and the server watermarks
 * that copy on arrival. `order` is the whole book banked at hardcover checkout:
 * the server keeps it as the clean file only and leaves the draft's public
 * link, its expiry and its watermark exactly as they were.
 */
type BankArgs = {
  pdf: Blob;
  petName: string;
  chapterCount: number;
  kind: DraftBankKind;
  /** Whose book this is. Two addresses in one browser get two drafts. */
  email: string | null;
};

/** The server will not save this book onto a draft that has been bought. */
class DraftPurchasedError extends Error {}

export async function bankBook(args: BankArgs): Promise<BankedBook> {
  const draft = await ensureDraft(args.email);
  try {
    return await bankOnto(draft, args);
  } catch (error) {
    if (!(error instanceof DraftPurchasedError)) throw error;
    // The draft this browser holds is a book somebody paid for, and this is a
    // different book. It gets a draft of its own, once.
    return bankOnto(await replaceStoredDraft(args.email), args);
  }
}

async function bankOnto(draft: StoredDraft, args: BankArgs): Promise<BankedBook> {
  const headers = draftHeaders(draft.draftId, draft.secret);
  const signResponse = await fetch("/api/drafts/upload-pdf", {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({ kind: args.kind }),
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
      kind: args.kind,
    }),
  });
  const finalized = (await finalizeResponse.json().catch(() => ({}))) as {
    expiresAt?: string | null;
    error?: string;
    code?: string;
  };
  if (finalizeResponse.status === 409 && finalized.code === "draft_purchased") {
    throw new DraftPurchasedError(finalized.error ?? "This book has already been bought.");
  }
  if (!finalizeResponse.ok) {
    throw new Error(finalized.error ?? "Your book could not be saved.");
  }

  return {
    draftId: draft.draftId,
    secret: draft.secret,
    url: bookUrl(draft.draftId, draft.secret),
    claim: claimUrl(draft.draftId, draft.secret),
    expiresAt: finalized.expiresAt ?? null,
  };
}
