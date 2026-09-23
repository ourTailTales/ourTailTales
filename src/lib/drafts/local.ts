import * as assetStore from "@/lib/photo/assetStore";
import {
  clearCustomCoverFile,
  getCustomCoverFile,
  setCustomCoverFile,
} from "@/lib/book/customCoverStore";
import {
  getStoredVideoPreview,
  restoreVideoPreview,
} from "@/lib/photo/videoPreview";
import type { BookSnapshot, OurTailTalesStore } from "@/store/useOurTailTalesStore";
import type { BookMeta, BookPage, Chapter, CustomCoverMeta } from "@/types/book";
import type { PhotoAsset, ProcessingProgressState } from "@/types/photo";

const DATABASE = "ourtailtales-local";
const STORE = "drafts";
const VERSION = 1;

/** Pre-2026-09 records all lived under this one shared key. Migrated on first read. */
const LEGACY_ACTIVE_KEY = "active";
/** Bucket for a session with no known email yet — shared like an anonymous cart. */
const ANONYMOUS_KEY = "anon";

/**
 * Each customer's in-progress album/book lives under its own key so two
 * different emails on the same browser never read or overwrite each other's
 * photos and story. Until an email is known, work is kept in a single
 * "anonymous" bucket (same trade-off as any pre-login cart); it's re-keyed to
 * that email's own bucket as soon as one is captured.
 */
function keyForEmail(email: string | null | undefined): string {
  const normalized = email?.trim().toLowerCase();
  return normalized ? `email:${normalized}` : ANONYMOUS_KEY;
}

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

type StoredCustomCover = CustomCoverMeta & { file: File };

type StoredDraft = {
  key: string;
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
  customCover?: StoredCustomCover;
  previewPdf?: Blob;
  /** The book as generated, so "reset to original" survives a reload. */
  originalBook?: BookSnapshot;
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
  customCover: CustomCoverMeta | null;
  previewPdf?: Blob;
  originalBook: BookSnapshot | null;
};

let activeDraftId: string | null = null;
let activeDraftKey: string | null = null;
let activePreviewPdf: Blob | null = null;

export async function persistLocalDraft(
  state: OurTailTalesStore,
  previewPdf?: Blob,
): Promise<string | null> {
  if (
    typeof indexedDB === "undefined" ||
    (state.photos.length === 0 && state.albumVideos.length === 0)
  ) {
    return null;
  }

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

  const customCoverFile = state.customCover ? getCustomCoverFile() : null;
  const customCover: StoredCustomCover | undefined =
    state.customCover && customCoverFile
      ? { ...state.customCover, file: customCoverFile }
      : undefined;

  const key = keyForEmail(state.leadEmail);
  const localDraftId = activeDraftKey === key && activeDraftId ? activeDraftId : crypto.randomUUID();
  if (previewPdf) activePreviewPdf = previewPdf;
  const draft: StoredDraft = {
    key,
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
    customCover,
    previewPdf: previewPdf ?? activePreviewPdf ?? undefined,
    originalBook: state.originalBook ?? undefined,
  };

  const database = await openDatabase();
  await requestPromise(
    database.transaction(STORE, "readwrite").objectStore(STORE).put(draft),
  );

  // Moving from one identity to another (anonymous → email, or one email to
  // another) — drop the old bucket so a subsequent visitor under the
  // previous identity doesn't inherit this session's content.
  if (activeDraftKey && activeDraftKey !== key) {
    await requestPromise(
      database.transaction(STORE, "readwrite").objectStore(STORE).delete(activeDraftKey),
    ).catch(() => {
      // Best effort — leaving a stale bucket behind is harmless.
    });
  }

  database.close();
  activeDraftId = localDraftId;
  activeDraftKey = key;
  return localDraftId;
}

export async function restoreLocalDraft(
  knownEmail?: string | null,
): Promise<RestoredLocalDraft | null> {
  if (typeof indexedDB === "undefined") return null;
  const database = await openDatabase();

  await migrateLegacyRecord(database);

  const key = keyForEmail(knownEmail);
  const stored = (await requestPromise(
    database.transaction(STORE, "readonly").objectStore(STORE).get(key),
  )) as StoredDraft | undefined;
  database.close();

  // Point at this bucket either way. A miss that left the pointer on the
  // previous address meant the next save deleted *that* person's book, on the
  // grounds that the identity had changed — which it had, in the wrong
  // direction.
  activeDraftKey = key;

  if (!stored || stored.version !== VERSION) {
    activeDraftId = null;
    activePreviewPdf = null;
    return null;
  }

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

  let customCover: CustomCoverMeta | null = null;
  if (stored.customCover) {
    const { file, ...meta } = stored.customCover;
    setCustomCoverFile(file);
    customCover = meta;
  } else {
    clearCustomCoverFile();
  }

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
    customCover,
    previewPdf: stored.previewPdf,
    originalBook: stored.originalBook ?? null,
  };
}

/**
 * One-time upgrade: before drafts were split per email, everyone shared the
 * single `LEGACY_ACTIVE_KEY` record. Move it into its rightful bucket (the
 * email it was saved under, or the anonymous one) so nobody's in-progress
 * book vanished the day this shipped. No-ops once it's been moved.
 */
async function migrateLegacyRecord(database: IDBDatabase): Promise<void> {
  const legacy = (await requestPromise(
    database
      .transaction(STORE, "readonly")
      .objectStore(STORE)
      .get(LEGACY_ACTIVE_KEY),
  ).catch(() => undefined)) as StoredDraft | undefined;
  if (!legacy) return;

  const targetKey = keyForEmail(legacy.leadEmail);
  const existingTarget = (await requestPromise(
    database.transaction(STORE, "readonly").objectStore(STORE).get(targetKey),
  ).catch(() => undefined)) as StoredDraft | undefined;

  if (!existingTarget) {
    await requestPromise(
      database
        .transaction(STORE, "readwrite")
        .objectStore(STORE)
        .put({ ...legacy, key: targetKey }),
    ).catch(() => {});
  }

  await requestPromise(
    database
      .transaction(STORE, "readwrite")
      .objectStore(STORE)
      .delete(LEGACY_ACTIVE_KEY),
  ).catch(() => {});
}

export function getLocalPreviewPdf(): Blob | null {
  return activePreviewPdf;
}

export function getLocalDraftId(): string | null {
  return activeDraftId;
}

export async function clearLocalDraft(): Promise<void> {
  const key = activeDraftKey ?? ANONYMOUS_KEY;
  activeDraftId = null;
  activeDraftKey = null;
  activePreviewPdf = null;
  if (typeof indexedDB === "undefined") return;
  const database = await openDatabase();
  await requestPromise(
    database.transaction(STORE, "readwrite").objectStore(STORE).delete(key),
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
