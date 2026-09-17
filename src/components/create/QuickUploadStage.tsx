"use client";

import { FolderOpen, FolderUp, Play, Plus, Sparkles } from "lucide-react";
import {
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
} from "react";

import { albumTilesFrom, type AlbumTile } from "@/components/editor/albumTiles";
import { filesFromDataTransfer, isLikelyMedia } from "@/lib/photo/process";
import { MIN_PHOTOS_FOR_BOOK } from "@/lib/pricing";
import {
  summarizeAlbum,
  useOurTailTalesStore,
} from "@/store/useOurTailTalesStore";

const MAX_BACKGROUND_TILES = 42;

export function QuickUploadStage({
  onFiles,
  onCreate,
}: {
  onFiles: (files: File[]) => void;
  onCreate: () => void;
}) {
  const photos = useOurTailTalesStore((state) => state.photos);
  const videos = useOurTailTalesStore((state) => state.albumVideos);
  const progress = useOurTailTalesStore((state) => state.progress);
  const processingError = useOurTailTalesStore((state) => state.processingError);

  const fileRef = useRef<HTMLInputElement>(null);
  const folderRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [readingDrop, setReadingDrop] = useState(false);

  const summary = useMemo(() => summarizeAlbum(photos), [photos]);
  const tiles = useMemo(
    () => albumTilesFrom(photos, videos),
    [photos, videos],
  );
  const backgroundTiles = tiles.slice(-MAX_BACKGROUND_TILES);
  const hasMedia = tiles.length > 0;
  const processing =
    readingDrop || (progress.total > 0 && progress.phase !== "done");
  const canCreate = !processing && summary.placeable >= MIN_PHOTOS_FOR_BOOK;

  const emit = (list: FileList | null): void => {
    const files = Array.from(list ?? []).filter(isLikelyMedia);
    if (files.length > 0) onFiles(files);
  };

  const handleChange = (event: ChangeEvent<HTMLInputElement>): void => {
    emit(event.target.files);
    event.target.value = "";
  };

  const handleDrop = (event: DragEvent<HTMLElement>): void => {
    event.preventDefault();
    setDragOver(false);
    if (processing) return;
    void (async () => {
      setReadingDrop(true);
      try {
        const files = await filesFromDataTransfer(event.dataTransfer);
        if (files.length > 0) onFiles(files);
      } finally {
        setReadingDrop(false);
      }
    })();
  };

  return (
    <section
      className={`quick-create-stage relative isolate overflow-hidden ${
        dragOver ? "ring-4 ring-inset ring-periwinkle/70" : ""
      }`}
      onDragEnter={(event) => {
        event.preventDefault();
        if (!processing) setDragOver(true);
      }}
      onDragOver={(event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = processing ? "none" : "copy";
      }}
      onDragLeave={(event) => {
        const next = event.relatedTarget;
        if (next instanceof Node && event.currentTarget.contains(next)) return;
        setDragOver(false);
      }}
      onDrop={handleDrop}
    >
      <input
        ref={fileRef}
        type="file"
        accept="image/*,video/*"
        multiple
        className="sr-only"
        onChange={handleChange}
      />
      <input
        ref={folderRef}
        type="file"
        {...({ webkitdirectory: "", directory: "" } as object)}
        multiple
        className="sr-only"
        onChange={handleChange}
      />

      <MediaBackdrop tiles={backgroundTiles} hasMedia={hasMedia} />

      <div className="relative z-10 mx-auto flex w-full max-w-[90rem] items-start justify-center px-5 py-8 sm:px-8 sm:py-10">
        <div className="w-full max-w-md rounded-[1.75rem] border border-white/80 bg-white/94 p-6 text-center shadow-[0_12px_32px_-20px_rgb(25_32_58/0.3)] backdrop-blur-xl sm:p-8">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={processing}
            className={`mx-auto flex size-20 items-center justify-center rounded-2xl border-2 border-dashed transition-colors sm:size-24 ${
              dragOver
                ? "border-periwinkle bg-periwinkle/10"
                : "border-periwinkle/45 bg-memory-blue/35 hover:border-periwinkle hover:bg-memory-blue/55"
            } disabled:cursor-wait`}
            aria-label={hasMedia ? "Add more photos and videos" : "Choose photos and videos"}
          >
            {processing ? (
              <span className="size-9 animate-spin rounded-full border-[3px] border-periwinkle/25 border-t-periwinkle" />
            ) : hasMedia ? (
              <Plus aria-hidden className="size-9 text-periwinkle" strokeWidth={1.8} />
            ) : (
              <FolderUp
                aria-hidden
                className="size-10 text-periwinkle"
                strokeWidth={1.5}
              />
            )}
          </button>

          {!hasMedia ? (
            <EmptyCopy />
          ) : processing ? (
            <ProcessingCopy
              processed={progress.processed}
              total={progress.total}
              visibleCount={tiles.length}
            />
          ) : (
            <ReadyCopy
              usablePhotos={summary.placeable}
              videos={videos.length}
              firstAt={summary.firstAt}
              lastAt={summary.lastAt}
            />
          )}

          {processingError ? (
            <p role="alert" className="mt-4 text-sm text-red-700">
              {processingError}
            </p>
          ) : null}

          {!hasMedia ? (
            <div className="mt-6 grid gap-3">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-periwinkle px-5 py-3 text-sm font-semibold text-white shadow-lift transition-colors hover:bg-periwinkle-deep"
              >
                <FolderOpen aria-hidden className="size-4" />
                Choose photos & videos
              </button>
              <button
                type="button"
                onClick={() => folderRef.current?.click()}
                className="text-sm font-semibold text-periwinkle underline decoration-periwinkle/30 underline-offset-4 hover:text-periwinkle-deep"
              >
                or choose a folder
              </button>
            </div>
          ) : !processing ? (
            <div className="mt-6 space-y-4">
              <div className="grid gap-3 sm:grid-cols-[0.75fr_1.25fr]">
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-page-line bg-white px-4 py-3 text-sm font-semibold text-page-ink transition-colors hover:border-periwinkle"
                >
                  <Plus aria-hidden className="size-4" />
                  Add more
                </button>
                <button
                  type="button"
                  onClick={onCreate}
                  disabled={!canCreate}
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-periwinkle px-4 py-3 text-sm font-semibold text-white shadow-lift transition-colors hover:bg-periwinkle-deep disabled:cursor-not-allowed disabled:bg-page-ink/25 disabled:shadow-none"
                >
                  <Sparkles aria-hidden className="size-4" />
                  Create my free book
                </button>
              </div>
              {summary.placeable < MIN_PHOTOS_FOR_BOOK ? (
                <p className="text-xs text-page-ink-soft">
                  Add {(MIN_PHOTOS_FOR_BOOK - summary.placeable).toLocaleString()} more usable photos to create your book.
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function EmptyCopy() {
  return (
    <div className="mt-6">
      <p className="font-display text-3xl font-bold text-page-ink sm:text-4xl">
        Turn their camera roll into a book
      </p>
      <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-page-ink-soft sm:text-base">
        Upload at least {MIN_PHOTOS_FOR_BOOK} photos. We’ll organize the years,
        choose the moments, and write their story.
      </p>
      <p className="mt-3 text-xs text-page-ink-faint">
        Your photos stay on this device while we build the preview.
      </p>
    </div>
  );
}

function ProcessingCopy({
  processed,
  total,
  visibleCount,
}: {
  processed: number;
  total: number;
  visibleCount: number;
}) {
  const done = Math.min(processed, total);
  const percent = total > 0 ? Math.round((done / total) * 100) : 0;
  return (
    <div className="mt-6" role="status" aria-live="polite">
      <p className="font-display text-3xl font-bold text-page-ink">
        Reading their memories…
      </p>
      <p className="mt-2 text-sm text-page-ink-soft">
        {total > 0
          ? `${done.toLocaleString()} of ${total.toLocaleString()} photos processed`
          : `${visibleCount.toLocaleString()} memories found`}
      </p>
      <div className="mt-5 h-2 overflow-hidden rounded-full bg-page-line/70">
        <div
          className="h-full rounded-full bg-periwinkle transition-[width] duration-300"
          style={{ width: `${Math.max(4, percent)}%` }}
        />
      </div>
      <p className="mt-3 text-xs text-page-ink-faint">
        Checking dates, quality, and duplicate moments.
      </p>
    </div>
  );
}

function ReadyCopy({
  usablePhotos,
  videos,
  firstAt,
  lastAt,
}: {
  usablePhotos: number;
  videos: number;
  firstAt: number | null;
  lastAt: number | null;
}) {
  const range = dateRange(firstAt, lastAt);
  return (
    <div className="mt-6">
      <p className="font-display text-3xl font-bold text-page-ink">
        Their album is ready
      </p>
      <p className="mt-2 text-sm text-page-ink-soft">
        {usablePhotos.toLocaleString()} usable {usablePhotos === 1 ? "photo" : "photos"}
        {videos > 0 ? ` · ${videos.toLocaleString()} ${videos === 1 ? "video" : "videos"}` : ""}
      </p>
      {range ? (
        <p className="mt-1 text-sm text-page-ink-faint">
          Memories from {range}
        </p>
      ) : null}
      {videos > 0 ? (
        <p className="mt-3 text-xs leading-5 text-page-ink-faint">
          Videos are saved for the later Video Memories step. Photos build this first preview.
        </p>
      ) : null}
    </div>
  );
}

function MediaBackdrop({
  tiles,
  hasMedia,
}: {
  tiles: AlbumTile[];
  hasMedia: boolean;
}) {
  return (
    <div className="absolute inset-0 -z-10">
      {hasMedia && tiles.length >= 4 ? (
        <div className="flex h-full flex-wrap content-center justify-center gap-2 p-3 opacity-55 sm:gap-3 sm:p-5">
          {tiles.map((tile) => (
            <div
              key={tile.id}
              className="relative h-36 w-28 shrink-0 overflow-hidden rounded-xl bg-white/50 shadow-sm animate-fade-up sm:h-44 sm:w-36"
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- local object URL */}
              <img src={tile.thumbUrl} alt="" className="h-full w-full object-cover" />
              {tile.kind === "video" ? (
                <span className="absolute bottom-2 left-2 flex size-7 items-center justify-center rounded-full bg-page-ink/75 text-white">
                  <Play aria-hidden className="ml-0.5 size-3" fill="currentColor" />
                </span>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}
      {hasMedia && tiles.length >= 4 ? (
        <div className="absolute inset-0 bg-[rgb(226_215_245/0.82)]" />
      ) : null}
    </div>
  );
}

function dateRange(firstAt: number | null, lastAt: number | null): string | null {
  if (firstAt === null || lastAt === null) return null;
  const first = new Date(firstAt).getFullYear();
  const last = new Date(lastAt).getFullYear();
  return first === last ? String(first) : `${first}–${last}`;
}
