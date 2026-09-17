import * as assetStore from "@/lib/photo/assetStore";
import {
  getStoredVideoPreview,
  restoreVideoPreview,
} from "@/lib/photo/videoPreview";
import type { OurTailTalesStore } from "@/store/useOurTailTalesStore";
import type { BookMeta, BookPage, Chapter } from "@/types/book";
import type { PhotoAsset, ProcessingProgressState } from "@/types/photo";

const DATABASE = "ourtailtales-local";
const STORE = "drafts";
const ACTIVE_KEY = "active";
const VERSION = 1;

type StoredPhoto = Omit<PhotoAsset, "thumbUrl"> & {
  file: File;
  thumbBlob: Blob;
};

type StoredVideo = {
  id: string;
  fileName: string;
  file: File;
  posterBlob: Blob;
};

type StoredDraft = {
  key: typeof ACTIVE_KEY;
  version: 1;
  localDraftId: string;
  savedAt: number;
  funnelState: "album_ready" | "editing";
  progress: ProcessingProgressState;
  meta: BookMeta;
  chapterCount: number;
  chapters: Chapter[];
  pages: BookPage[];
  leadEmail: string | null;
  photos: StoredPhoto[];
  videos: StoredVideo[];
  previewPdf?: Blob;
};

export type RestoredLocalDraft = Pick<
  StoredDraft,
  | "localDraftId"
  | "savedAt"
  | "funnelState"
  | "progress"
  | "meta"
  | "chapterCount"
  | "chapters"
  | "pages"
  | "leadEmail"
> & {
  photos: PhotoAsset[];
  albumVideos: {
    id: string;
    fileName: string;
    posterUrl: string;
    previewUrl: string;
  }[];
  previewPdf?: Blob;
};

let activeDraftId: string | null = null;
let activePreviewPdf: Blob | null = null;

export async function persistLocalDraft(
  state: OurTailTalesStore,
  previewPdf?: Blob,
): Promise<string | null> {
  if (typeof indexedDB === "undefined" || state.photos.length === 0) return null;

  const photos: StoredPhoto[] = [];
  for (const photo of state.photos) {
    const file = assetStore.getFile(photo.id);
    const thumbBlob = assetStore.getThumbBlob(photo.id);
    if (!file || !thumbBlob) continue;
    const { thumbUrl: _thumbUrl, ...metadata } = photo;
    void _thumbUrl;
    photos.push({ ...metadata, file, thumbBlob });
  }

  const videos: StoredVideo[] = [];
  for (const video of state.albumVideos) {
    const stored = getStoredVideoPreview(video.id);
    if (!stored) continue;
    videos.push({
      id: video.id,
      fileName: video.fileName,
      file: stored.file,
      posterBlob: stored.posterBlob,
    });
  }

  const localDraftId = activeDraftId ?? crypto.randomUUID();
  activeDraftId = localDraftId;
  if (previewPdf) activePreviewPdf = previewPdf;
  const draft: StoredDraft = {
    key: ACTIVE_KEY,
    version: VERSION,
    localDraftId,
    savedAt: Date.now(),
    funnelState: state.funnelState === "editing" ? "editing" : "album_ready",
    progress: { ...state.progress, phase: "done" },
    meta: state.meta,
    chapterCount: state.chapterCount,
    chapters: state.chapters,
    pages: state.pages,
    leadEmail: state.leadEmail,
    photos,
    videos,
    previewPdf: previewPdf ?? activePreviewPdf ?? undefined,
  };

  const database = await openDatabase();
  await requestPromise(
    database.transaction(STORE, "readwrite").objectStore(STORE).put(draft),
  );
  database.close();
  return localDraftId;
}

export async function restoreLocalDraft(): Promise<RestoredLocalDraft | null> {
  if (typeof indexedDB === "undefined") return null;
  const database = await openDatabase();
  const stored = (await requestPromise(
    database.transaction(STORE, "readonly").objectStore(STORE).get(ACTIVE_KEY),
  )) as StoredDraft | undefined;
  database.close();
  if (!stored || stored.version !== VERSION) return null;

  activeDraftId = stored.localDraftId;
  activePreviewPdf = stored.previewPdf ?? null;
  const photos = stored.photos.map(({ file, thumbBlob, ...metadata }) => ({
    ...metadata,
    thumbUrl: assetStore.putAsset(metadata.id, file, thumbBlob),
  }));
  const albumVideos = stored.videos.map((video) => ({
    id: video.id,
    fileName: video.fileName,
    ...restoreVideoPreview(video.id, video.file, video.posterBlob),
  }));

  return {
    localDraftId: stored.localDraftId,
    savedAt: stored.savedAt,
    funnelState: stored.funnelState,
    progress: stored.progress,
    meta: stored.meta,
    chapterCount: stored.chapterCount,
    chapters: stored.chapters,
    pages: stored.pages,
    leadEmail: stored.leadEmail,
    photos,
    albumVideos,
    previewPdf: stored.previewPdf,
  };
}

export function getLocalPreviewPdf(): Blob | null {
  return activePreviewPdf;
}

export function getLocalDraftId(): string | null {
  return activeDraftId;
}

export async function clearLocalDraft(): Promise<void> {
  activeDraftId = null;
  activePreviewPdf = null;
  if (typeof indexedDB === "undefined") return;
  const database = await openDatabase();
  await requestPromise(
    database.transaction(STORE, "readwrite").objectStore(STORE).delete(ACTIVE_KEY),
  );
  database.close();
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE)) {
        database.createObjectStore(STORE, { keyPath: "key" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Local draft storage failed."));
  });
}

function requestPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Local draft storage failed."));
  });
}
