import { postHogHeaders } from "@/lib/posthog-client";
import type { VideoAsset, VideoMemoryPlacement } from "@/types/video-memory";

/**
 * Server-side draft credentials, kept per email address.
 *
 * This used to be one key for the whole browser, which meant two people
 * sharing a laptop — or one person trying a second address — banked into the
 * same `book_drafts` row, the same storage folder, and the same emailed link.
 * The second book quietly replaced the first. Bucketed the same way the local
 * album is, so an address only ever reaches its own book.
 */
const DRAFT_STORAGE_PREFIX = "ourtailtales.draft";

/** Pre-2026-09 sessions kept their draft here, unbucketed. Migrated on first read. */
const LEGACY_DRAFT_KEY = DRAFT_STORAGE_PREFIX;

export type StoredDraft = {
  draftId: string;
  secret: string;
};

function draftStorageKey(email: string | null | undefined): string {
  const normalized = email?.trim().toLowerCase();
  return normalized
    ? `${DRAFT_STORAGE_PREFIX}:email:${normalized}`
    : `${DRAFT_STORAGE_PREFIX}:anon`;
}

export type VideoMemoryPublicConfig = {
  maxDurationMs: number;
  maxSourceBytes: number;
  packSize: number;
  packPriceCents: number;
  durationTooLongMessage: string;
  storageInconsistent: boolean;
};

export function draftHeaders(
  draftId: string,
  secret: string,
): Record<string, string> {
  return {
    ...postHogHeaders(),
    "x-draft-id": draftId,
    authorization: `Bearer ${secret}`,
  };
}

export function loadStoredDraft(email?: string | null): StoredDraft | null {
  if (typeof window === "undefined") return null;
  migrateLegacyDraft();
  return readDraft(draftStorageKey(email));
}

/**
 * Returns false when the browser would not keep it.
 *
 * Safari in private browsing throws here, and this sits in the middle of
 * banking the book and mailing the link: an unguarded throw took out the
 * teaser PDF, the email and the book link together, with nothing shown to the
 * customer. The draft still works for the rest of this tab either way; what
 * is lost is finding it again after a reload.
 */
export function storeDraft(draft: StoredDraft, email?: string | null): boolean {
  if (typeof window === "undefined") return false;
  try {
    window.localStorage.setItem(draftStorageKey(email), JSON.stringify(draft));
    return true;
  } catch (error) {
    console.error("[ourTailTales] This browser would not store the draft", error);
    return false;
  }
}

function readDraft(key: string): StoredDraft | null {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredDraft;
    if (!parsed.draftId || !parsed.secret) return null;
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Moves a pre-bucketing draft into the anonymous bucket, so nobody's
 * in-progress book vanished the day this shipped. No-ops once moved.
 */
function migrateLegacyDraft(): void {
  try {
    const legacy = readDraft(LEGACY_DRAFT_KEY);
    if (!legacy) return;
    const anonKey = draftStorageKey(null);
    if (!readDraft(anonKey)) {
      window.localStorage.setItem(anonKey, JSON.stringify(legacy));
    }
    window.localStorage.removeItem(LEGACY_DRAFT_KEY);
  } catch {
    // A browser refusing localStorage is handled by every caller already.
  }
}

export async function createDraft(email?: string | null): Promise<StoredDraft> {
  const response = await fetch("/api/drafts", { method: "POST" });
  const data = (await response.json()) as {
    draftId?: string;
    secret?: string;
    error?: string;
  };
  if (!response.ok || !data.draftId || !data.secret) {
    throw new Error(data.error ?? "A draft could not be created.");
  }
  const draft = { draftId: data.draftId, secret: data.secret };
  storeDraft(draft, email);
  return draft;
}

export async function ensureDraft(email?: string | null): Promise<StoredDraft> {
  return loadStoredDraft(email) ?? createDraft(email);
}

export async function fetchVideoMemoryConfig(): Promise<VideoMemoryPublicConfig> {
  const response = await fetch("/api/video-memory/config");
  const data = (await response.json()) as VideoMemoryPublicConfig & {
    error?: string;
  };
  if (!response.ok) {
    throw new Error(data.error ?? "Video Memory settings could not be loaded.");
  }
  return data;
}

export async function fetchVideoLibrary(
  draft: StoredDraft,
): Promise<{ assets: VideoAsset[]; placements: VideoMemoryPlacement[] }> {
  const response = await fetch("/api/videos", {
    headers: draftHeaders(draft.draftId, draft.secret),
  });
  const data = (await response.json()) as {
    assets?: VideoAsset[];
    placements?: VideoMemoryPlacement[];
    error?: string;
  };
  if (!response.ok) {
    throw new Error(data.error ?? "Video Memories could not be loaded.");
  }
  return {
    assets: data.assets ?? [],
    placements: data.placements ?? [],
  };
}

export async function uploadVideoMemory(
  draft: StoredDraft,
  file: File,
  hints: { durationMs?: number; title?: string },
): Promise<{ assetId: string }> {
  const authorized = await postJson<{
    assetId: string;
    signedUrl: string;
  }>("/api/videos/authorize", {
    fileName: file.name,
    bytes: file.size,
    contentType: file.type || undefined,
    durationMs: hints.durationMs,
    title: hints.title,
  }, draft);

  const put = await fetch(authorized.signedUrl, {
    method: "PUT",
    headers: {
      "Content-Type": file.type || "video/mp4",
      "x-upsert": "true",
    },
    body: file,
  });
  if (!put.ok) {
    throw new Error("That video could not be uploaded. Please try again.");
  }

  await postJson("/api/videos/complete", { assetId: authorized.assetId }, draft);
  return { assetId: authorized.assetId };
}

export async function placeVideoMemory(
  draft: StoredDraft,
  videoAssetId: string,
  pageId: string,
): Promise<VideoMemoryPlacement> {
  const data = await postJson<{ placement: VideoMemoryPlacement }>(
    "/api/placements",
    { videoAssetId, pageId },
    draft,
  );
  return data.placement;
}

export async function updatePlacementPage(
  draft: StoredDraft,
  placementId: string,
  pageId: string,
): Promise<void> {
  await requestJson(`/api/placements/${placementId}`, {
    method: "PATCH",
    body: { pageId },
    draft,
  });
}

export async function removePlacementFromPage(
  draft: StoredDraft,
  placementId: string,
): Promise<void> {
  await requestJson(`/api/placements/${placementId}`, {
    method: "DELETE",
    draft,
  });
}

export async function deleteVideoMemory(
  draft: StoredDraft,
  assetId: string,
): Promise<void> {
  await requestJson(`/api/videos/${assetId}`, {
    method: "DELETE",
    draft,
  });
}

export async function retryVideoMemory(
  draft: StoredDraft,
  assetId: string,
): Promise<void> {
  await postJson(`/api/videos/${assetId}/retry`, {}, draft);
}

export async function renameVideoMemory(
  draft: StoredDraft,
  assetId: string,
  title: string,
): Promise<void> {
  await requestJson(`/api/videos/${assetId}`, {
    method: "PATCH",
    body: { title },
    draft,
  });
}

export function readVideoDurationMs(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.preload = "metadata";
    video.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      resolve(video.duration * 1000);
    };
    video.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("That video could not be read."));
    };
    video.src = url;
  });
}

async function postJson<T>(
  url: string,
  body: unknown,
  draft: StoredDraft,
): Promise<T> {
  return requestJson<T>(url, { method: "POST", body, draft });
}

async function requestJson<T>(
  url: string,
  options: {
    method: string;
    body?: unknown;
    draft: StoredDraft;
  },
): Promise<T> {
  const response = await fetch(url, {
    method: options.method,
    headers: {
      "Content-Type": "application/json",
      ...draftHeaders(options.draft.draftId, options.draft.secret),
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  const data = (await response.json().catch(() => ({}))) as T & {
    error?: string;
  };
  if (!response.ok) {
    throw new Error(data.error ?? "That request could not be completed.");
  }
  return data;
}
