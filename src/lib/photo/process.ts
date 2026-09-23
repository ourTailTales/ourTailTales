import * as assetStore from "@/lib/photo/assetStore";
import { processFile } from "@/lib/photo/pipeline";
import type { WorkerRequest, WorkerResponse } from "@/lib/photo/worker";
import type { ProcessedPhoto } from "@/types/photo";

const FLUSH_SIZE = 24;
const FLUSH_MS = 120;
const FALLBACK_CONCURRENCY = 4;

export type IngestionHandlers = {
  /** Called with completed photos in batches, to bound React re-renders. */
  onBatch: (photos: ProcessedPhoto[]) => void;
  onFailures: (count: number) => void;
  onDone: () => void;
  onError: (message: string) => void;
};

export type Ingestion = {
  cancel: () => void;
};

/**
 * Streams an album through the processing worker.
 *
 * Only `File` handles cross the boundary, so selecting 2,000 photos does not
 * read 2,000 files up front. Results arrive incrementally and each thumbnail
 * Blob is parked in the module asset store rather than React state.
 */
export function startIngestion(
  files: File[],
  handlers: IngestionHandlers,
): Ingestion {
  const items = files.map((file) => ({ id: crypto.randomUUID(), file }));
  const filesById = new Map(items.map((item) => [item.id, item.file]));

  let buffer: ProcessedPhoto[] = [];
  let failures = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let stopped = false;

  const flush = (): void => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
    if (failures > 0) {
      handlers.onFailures(failures);
      failures = 0;
    }
    if (buffer.length === 0) return;
    const batch = buffer;
    buffer = [];
    handlers.onBatch(batch);
  };

  const scheduleFlush = (): void => {
    if (buffer.length >= FLUSH_SIZE) {
      flush();
      return;
    }
    timer ??= setTimeout(flush, FLUSH_MS);
  };

  /** Ids already through, so a fallback run cannot take them twice. */
  const accepted = new Set<string>();

  const acceptPhoto = (photo: ProcessedPhoto): void => {
    const file = filesById.get(photo.id);
    if (!file) return;
    if (accepted.has(photo.id)) return;
    accepted.add(photo.id);
    assetStore.putAsset(photo.id, file, photo.thumbBlob);
    buffer.push(photo);
    scheduleFlush();
  };

  const finish = (): void => {
    if (stopped) return;
    stopped = true;
    flush();
    handlers.onDone();
  };

  let worker: Worker | null = null;
  try {
    worker = new Worker(new URL("./worker.ts", import.meta.url), {
      type: "module",
    });
  } catch {
    worker = null;
  }

  if (worker) {
    const active = worker;

    active.addEventListener("message", (event: MessageEvent<WorkerResponse>) => {
      const message = event.data;
      if (message.type === "photo") {
        acceptPhoto(message.photo);
        return;
      }
      if (message.type === "failed") {
        failures += 1;
        scheduleFlush();
        return;
      }
      if (message.type === "done") {
        finish();
        active.terminate();
      }
    });

    active.addEventListener("error", () => {
      // The worker died; finish this album on the main thread. Only the ones
      // it had not already delivered: restarting over the whole list put the
      // same photo in twice, which is a duplicate React key and the same
      // picture placed twice in the chapter proposals.
      active.terminate();
      if (stopped) return;
      const remaining = items.filter((item) => !accepted.has(item.id));
      if (remaining.length === 0) {
        finish();
        return;
      }
      void runOnMainThread(remaining, acceptPhoto, () => {
        failures += 1;
      }, finish, () => stopped);
    });

    post(active, { type: "process", items });

    return {
      cancel: () => {
        stopped = true;
        if (timer !== null) clearTimeout(timer);
        post(active, { type: "cancel" });
        active.terminate();
      },
    };
  }

  void runOnMainThread(
    items,
    acceptPhoto,
    () => {
      failures += 1;
    },
    finish,
    () => stopped,
  ).catch((error: unknown) => {
    handlers.onError(
      error instanceof Error ? error.message : "Could not read those photos.",
    );
  });

  return {
    cancel: () => {
      stopped = true;
      if (timer !== null) clearTimeout(timer);
    },
  };
}

/** Same bounded-concurrency contract, for browsers where the worker fails. */
async function runOnMainThread(
  items: { id: string; file: File }[],
  onPhoto: (photo: ProcessedPhoto) => void,
  onFailure: () => void,
  onDone: () => void,
  isStopped: () => boolean,
): Promise<void> {
  let cursor = 0;

  const lane = async (): Promise<void> => {
    while (!isStopped()) {
      const index = cursor;
      cursor += 1;
      if (index >= items.length) return;
      try {
        onPhoto(await processFile(items[index].id, items[index].file));
      } catch {
        onFailure();
      }
      // Yield so the progress meter keeps painting.
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(FALLBACK_CONCURRENCY, items.length) }, lane),
  );
  onDone();
}

function post(worker: Worker, message: WorkerRequest): void {
  worker.postMessage(message);
}

const IMAGE_PATTERN = /\.(jpe?g|png|webp|gif|bmp|tiff?|heic|heif|avif)$/i;
const VIDEO_PATTERN = /\.(mp4|m4v|mov|webm|avi|mkv|3gp)$/i;

export function isLikelyImage(file: File): boolean {
  return file.type.startsWith("image/") || IMAGE_PATTERN.test(file.name);
}

export function isLikelyVideo(file: File): boolean {
  return file.type.startsWith("video/") || VIDEO_PATTERN.test(file.name);
}

export function isLikelyMedia(file: File): boolean {
  return isLikelyImage(file) || isLikelyVideo(file);
}

export function partitionMedia(files: File[]): {
  images: File[];
  videos: File[];
} {
  const images: File[] = [];
  const videos: File[] = [];
  for (const file of files) {
    if (isLikelyImage(file)) images.push(file);
    else if (isLikelyVideo(file)) videos.push(file);
  }
  return { images, videos };
}

/**
 * Collects files from a drop, walking directories so a customer can drag a
 * whole album folder in.
 */
export async function filesFromDataTransfer(
  transfer: DataTransfer,
): Promise<File[]> {
  const entries = Array.from(transfer.items)
    .filter((item) => item.kind === "file")
    .map((item) => item.webkitGetAsEntry?.() ?? null);

  if (entries.every((entry) => entry === null)) {
    return Array.from(transfer.files).filter(isLikelyMedia);
  }

  const collected: File[] = [];
  for (const entry of entries) {
    if (entry) await walkEntry(entry, collected);
  }
  return collected.filter(isLikelyMedia);
}

async function walkEntry(
  entry: FileSystemEntry,
  collected: File[],
): Promise<void> {
  if (entry.isFile) {
    const file = await new Promise<File | null>((resolve) => {
      (entry as FileSystemFileEntry).file(
        (value) => resolve(value),
        () => resolve(null),
      );
    });
    if (file) collected.push(file);
    return;
  }

  if (entry.isDirectory) {
    const reader = (entry as FileSystemDirectoryEntry).createReader();
    for (;;) {
      const batch = await new Promise<FileSystemEntry[]>((resolve) => {
        reader.readEntries(
          (values) => resolve(values),
          () => resolve([]),
        );
      });
      if (batch.length === 0) return;
      for (const child of batch) await walkEntry(child, collected);
    }
  }
}
