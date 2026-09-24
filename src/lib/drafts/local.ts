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
  /**
   * When the banked free preview expires, and its link. Kept here so the
   * expiry banner is still on screen after a reload — the upload that
   * returns them only runs once, when the story is first written.
   */
  bookExpiresAt?: string | null;
  bookUrl?: string | null;
};

export type LocalSaveResult = {
  localDraftId: string;
  /**
   * Photos whose binary was not in the asset store when this ran, and so are
   * not in the saved record. Their references are pruned on the way back out.
   */
  missingPhotos: number;
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
  | "bookExpiresAt"
  | "bookUrl"
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
  /** Photos the record referred to but did not contain. */
  missingPhotos: number;
};

let activeDraftId: string | null = null;
let activeDraftKey: string | null = null;
let activePreviewPdf: Blob | null = null;

/**
 * One queue for every read and write, because the three variables above are
 * module state and two callers can be in here at once.
 *
 * The landing page navigates client side, so submitting a second address, or
 * going back and forward between two of them, starts a second restore while
 * the first is still running. Interleaved, they could leave the store holding
 * one address's book while the pointer named the other's, and the next save
 * would then write this content into that person's bucket and delete the
 * bucket it came from. Running them in order makes the last one asked for the
 * one that wins, which is what the caller meant.
 */
let queue: Promise<unknown> = Promise.resolve();

function serialize<T>(work: () => Promise<T>): Promise<T> {
  const next = queue.then(work, work);
  // The queue must not inherit a rejection, or every later operation fails.
  queue = next.then(
    () => undefined,
    () => undefined,
  );
  return next;
}

async function withDatabase<T>(
  work: (database: IDBDatabase) => Promise<T>,
): Promise<T> {
  const database = await openDatabase();
  try {
    return await work(database);
  } finally {
    // Missing on the failure paths before, so a browser under storage
    // pressure — exactly when these fail — accumulated open connections.
    database.close();
  }
}

/**
 * Resolves when the data is actually on disk.
 *
 * A request's `onsuccess` fires while the transaction is still open; the
 * commit can still abort afterwards, and on quota pressure it does. Waiting
 * on the request alone is what let the interface say "Saved" over a write
 * that never landed.
 */
function committed(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = () =>
      reject(transaction.error ?? new Error("Local draft storage is full."));
    transaction.onerror = () =>
      reject(transaction.error ?? new Error("Local draft storage failed."));
  });
}

export async function persistLocalDraft(
  state: OurTailTalesStore,
  previewPdf?: Blob,
): Promise<LocalSaveResult | null> {
  if (
    typeof indexedDB === "undefined" ||
    (state.photos.length === 0 && state.albumVideos.length === 0)
  ) {
    return null;
  }

  const photos: StoredPhoto[] = [];
  let missingPhotos = 0;
  for (const photo of state.photos) {
    const file = assetStore.getFile(photo.id);
    const thumbBlob = assetStore.getThumbBlob(photo.id);
    // Counted rather than passed over in silence. The chapters and pages
    // still name this photo, so a record saved without it restores a book
    // with a hole in it and a PDF that cannot resolve what it points at.
    if (!file || !thumbBlob) {
      missingPhotos += 1;
      continue;
    }
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

  return serialize(async () => {
  // Everything that touches the three module pointers happens in here. Read
  // outside the queue, they can be the values a restore is halfway through
  // changing, and the delete below then names the wrong bucket.
  const localDraftId =
    activeDraftKey === key && activeDraftId ? activeDraftId : crypto.randomUUID();
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
    bookExpiresAt: state.bookExpiresAt?.toISOString() ?? null,
    bookUrl: state.bookUrl,
  };

  const previousKey = activeDraftKey;

  await withDatabase(async (database) => {
    const transaction = database.transaction(STORE, "readwrite");
    const objectStore = transaction.objectStore(STORE);
    objectStore.put(draft);

    // Moving from one identity to another (anonymous → email, or one email
    // to another) — drop the old bucket so a subsequent visitor under the
    // previous identity doesn't inherit this session's content. In the same
    // transaction as the put, so a failure can never take the old book away
    // without having written the new one.
    if (previousKey && previousKey !== key) objectStore.delete(previousKey);

    await committed(transaction);
  });

  activeDraftId = localDraftId;
  activeDraftKey = key;
  return { localDraftId, missingPhotos };
  });
}

export async function restoreLocalDraft(
  knownEmail?: string | null,
): Promise<RestoredLocalDraft | null> {
  if (typeof indexedDB === "undefined") return null;

  const key = keyForEmail(knownEmail);

  return serialize(async () => {
  // Claim the bucket before anything here can fail.
  //
  // Doing it after the read meant a read that threw left the pointer on the
  // previous address. The caller then cleared the screen for the new one, and
  // that person's first save deleted the previous person's intact record as
  // "the old bucket" — the precise loss this whole file is arranged to
  // prevent, caused by the branch added to prevent it.
  const changingBucket = activeDraftKey !== key;
  activeDraftKey = key;
  if (changingBucket) {
    // The cached preview belongs to whoever we were reading for. Held on to,
    // it ends up written into the next person's record and handed to their
    // book as if it were theirs.
    activeDraftId = null;
    activePreviewPdf = null;
  }

  // Throws rather than returning null when storage itself fails. The two mean
  // completely different things to the caller: nothing saved under this
  // address is a reason to clear the screen, and "the database would not open
  // just now" is a reason to leave the book exactly where it is. Treating the
  // second as the first is how an intact record gets written straight over.
  const stored = await withDatabase(async (database) => {
    await migrateLegacyRecord(database);
    return (await requestPromise(
      database.transaction(STORE, "readonly").objectStore(STORE).get(key),
    )) as StoredDraft | undefined;
  });

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

  // A record can name photos it does not contain: the binary was missing from
  // the asset store when it was written. Left in place, those names are
  // blank slots in the book and a print render that cannot resolve what it
  // points at, so they come out here rather than being discovered later.
  const present = new Set(photos.map((photo) => photo.id));
  const named = new Set<string>();
  for (const chapter of stored.chapters) {
    for (const id of chapter.photoIds) named.add(id);
  }
  for (const page of stored.pages) {
    for (const id of page.photoIds) named.add(id);
  }
  const missingPhotos = [...named].filter((id) => !present.has(id)).length;
  const keep = (ids: string[]): string[] => ids.filter((id) => present.has(id));

  if (missingPhotos > 0) {
    console.warn(
      `[ourTailTales] ${missingPhotos} photo(s) were missing from the saved book.`,
    );
  }

  return {
    localDraftId: stored.localDraftId,
    savedAt: stored.savedAt,
    funnelState: stored.funnelState,
    progress: stored.progress,
    meta: stored.meta,
    chapterCount: stored.chapterCount,
    chapters:
      missingPhotos === 0
        ? stored.chapters
        : stored.chapters.map((chapter) => ({
            ...chapter,
            photoIds: keep(chapter.photoIds),
          })),
    pages:
      missingPhotos === 0
        ? stored.pages
        : stored.pages.map((page) => ({
            ...page,
            photoIds: keep(page.photoIds),
          })),
    leadEmail: stored.leadEmail,
    photos,
    albumVideos,
    customCover,
    previewPdf: stored.previewPdf,
    originalBook: stored.originalBook ?? null,
    bookExpiresAt: stored.bookExpiresAt ?? null,
    bookUrl: stored.bookUrl ?? null,
    missingPhotos,
  };
  });
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
    // The delete only runs if the copy actually committed. It used to run
    // either way, so a browser that refused the write — out of space, which
    // is the likeliest reason it refused — lost the record instead of moving
    // it, and that was somebody's only copy of their book.
    try {
      const transaction = database.transaction(STORE, "readwrite");
      transaction.objectStore(STORE).put({ ...legacy, key: targetKey });
      await committed(transaction);
    } catch (error) {
      console.error("[ourTailTales] Could not move the legacy draft", error);
      return;
    }
  }

  try {
    const transaction = database.transaction(STORE, "readwrite");
    transaction.objectStore(STORE).delete(LEGACY_ACTIVE_KEY);
    await committed(transaction);
  } catch {
    // Harmless: the record now exists in both places and the next read finds
    // the bucketed one.
  }
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
  await serialize(() =>
    withDatabase(async (database) => {
      const transaction = database.transaction(STORE, "readwrite");
      transaction.objectStore(STORE).delete(key);
      await committed(transaction);
    }),
  );
}

/** Long enough for a slow disk, short enough that nothing waits on it forever. */
const OPEN_TIMEOUT_MS = 10_000;

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, VERSION);
    let settled = false;

    const finish = (
      outcome: "resolve" | "reject",
      value: IDBDatabase | Error,
    ): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (outcome === "resolve") resolve(value as IDBDatabase);
      else reject(value as Error);
    };

    // Every operation queues behind this one, so an open that never settles
    // stops the app saving for the rest of the session with the indicator
    // still reading "Saving…". A version upgrade pending in another tab does
    // exactly that, and fires `onblocked` rather than either handler below.
    const timer = setTimeout(
      () => finish("reject", new Error("Local draft storage did not open.")),
      OPEN_TIMEOUT_MS,
    );

    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE)) {
        database.createObjectStore(STORE, { keyPath: "key" });
      }
    };
    request.onblocked = () =>
      finish("reject", new Error("Another tab is holding local draft storage."));
    request.onsuccess = () => finish("resolve", request.result);
    request.onerror = () =>
      finish(
        "reject",
        request.error ?? new Error("Local draft storage failed."),
      );
  });
}

function requestPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Local draft storage failed."));
  });
}
