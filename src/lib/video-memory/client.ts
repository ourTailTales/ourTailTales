import type { VideoAsset, VideoMemoryPlacement } from "@/types/video-memory";

const DRAFT_STORAGE_KEY = "ourtailtales.draft";

export type StoredDraft = {
  draftId: string;
  secret: string;
};

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
    "x-draft-id": draftId,
    authorization: `Bearer ${secret}`,
  };
}

export function loadStoredDraft(): StoredDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(DRAFT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredDraft;
    if (!parsed.draftId || !parsed.secret) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function storeDraft(draft: StoredDraft): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft));
}

export async function createDraft(): Promise<StoredDraft> {
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
  storeDraft(draft);
  return draft;
}

export async function ensureDraft(): Promise<StoredDraft> {
  return loadStoredDraft() ?? createDraft();
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
