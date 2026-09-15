"use client";

import { ArrowRight, ChevronDown, Folder, FolderUp, X } from "lucide-react";
import { useEffect, useMemo, useRef, type ChangeEvent, type ReactNode } from "react";

import {
  partitionAlbumChronologically,
  photoPrintStatus,
  printIssue,
  splitPhotoTiles,
  type AlbumTile,
} from "@/components/editor/albumTiles";
import { isLikelyMedia } from "@/lib/photo/process";
import { MIN_PHOTOS_FOR_BOOK } from "@/lib/pricing";

export function MediaUploadStep({
  tiles,
  readyCount,
  processing,
  dragOver,
  canNext,
  onFiles,
  onRemove,
  onNext,
}: {
  tiles: AlbumTile[];
  readyCount: number;
  processing: boolean;
  dragOver: boolean;
  canNext: boolean;
  onFiles: (files: File[]) => void;
  onRemove: (id: string, kind: "photo" | "video") => void;
  onNext: () => void;
}) {
  const photosRef = useRef<HTMLInputElement>(null);
  const folderRef = useRef<HTMLInputElement>(null);

  const { photos, videos } = useMemo(
    () => partitionAlbumChronologically(tiles),
    [tiles],
  );

  const emit = (list: FileList | null): void => {
    const files = Array.from(list ?? []).filter(isLikelyMedia);
    if (files.length > 0) onFiles(files);
  };

  const handleChange = (event: ChangeEvent<HTMLInputElement>): void => {
    emit(event.target.files);
    event.target.value = "";
  };

  const mediaCount = readyCount + videos.length;
  const remaining = Math.max(0, MIN_PHOTOS_FOR_BOOK - mediaCount);
  const hasMedia = photos.length > 0 || videos.length > 0;

  const uploadControl = (
    <UploadControl
      processing={processing}
      dragOver={dragOver}
      remaining={remaining}
      readyCount={readyCount}
      videoCount={videos.length}
      mediaCount={mediaCount}
      hasMedia={hasMedia}
      compact={hasMedia}
      onAddPhotos={() => photosRef.current?.click()}
      onAddFolder={() => folderRef.current?.click()}
    />
  );

  return (
    <div
      className={`relative z-10 min-h-[min(68vh,36rem)] px-5 py-8 sm:px-8 sm:py-10 ${
        hasMedia
          ? "flex flex-col gap-6 sm:flex-row sm:items-start sm:gap-6"
          : "flex flex-col items-center justify-center"
      }`}
    >
      <input
        ref={photosRef}
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

      {hasMedia ? (
        <>
          <div className="min-h-0 min-w-0 flex-1">
            <div className="space-y-8">
              {photos.length > 0 ? (
                <PhotosSection photos={photos} onRemove={onRemove} />
              ) : null}
              {videos.length > 0 ? (
                <MediaSection
                  title="Videos"
                  count={videos.length}
                  tiles={videos}
                  onRemove={onRemove}
                />
              ) : null}
            </div>
          </div>
          <UploadActionPanel canNext={canNext} onNext={onNext}>
            {uploadControl}
          </UploadActionPanel>
        </>
      ) : (
        <aside className="w-full max-w-xs">{uploadControl}</aside>
      )}
    </div>
  );
}

function UploadActionPanel({
  canNext,
  onNext,
  children,
}: {
  canNext: boolean;
  onNext: () => void;
  children: ReactNode;
}) {
  return (
    <div className="flex w-full shrink-0 flex-col rounded-2xl bg-lavender/45 p-3 sm:w-44 lg:w-48">
      {children}
      <button
        type="button"
        onClick={onNext}
        disabled={!canNext}
        className="mt-4 inline-flex min-h-11 w-full cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-periwinkle px-3 py-2.5 text-sm font-semibold text-white shadow-lift transition-colors hover:bg-periwinkle-deep disabled:cursor-not-allowed disabled:bg-page-ink/25 disabled:shadow-none"
      >
        Next
        <ArrowRight aria-hidden className="h-4 w-4" strokeWidth={2.25} />
      </button>
    </div>
  );
}

function UploadControl({
  processing,
  dragOver,
  remaining,
  readyCount,
  videoCount,
  mediaCount,
  hasMedia,
  compact,
  onAddPhotos,
  onAddFolder,
}: {
  processing: boolean;
  dragOver: boolean;
  remaining: number;
  readyCount: number;
  videoCount: number;
  mediaCount: number;
  hasMedia: boolean;
  compact: boolean;
  onAddPhotos: () => void;
  onAddFolder: () => void;
}) {
  return (
    <>
      <button
        type="button"
        onClick={onAddPhotos}
        className={`flex aspect-square w-full cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dotted bg-transparent text-center transition-colors ${
          compact ? "px-3" : "px-5"
        } ${
          dragOver
            ? "border-periwinkle"
            : "border-page-line hover:border-periwinkle"
        }`}
      >
        <FolderUp
          aria-hidden
          className={
            compact
              ? "h-7 w-7 text-periwinkle sm:h-8 sm:w-8"
              : "h-11 w-11 text-periwinkle"
          }
          strokeWidth={1.5}
        />
        <span
          className={
            compact
              ? "mt-2 font-display text-base leading-snug text-page-ink sm:text-lg"
              : "mt-3 font-display text-xl leading-snug text-page-ink sm:text-2xl"
          }
        >
          {processing ? "Reading…" : "Add photos & videos"}
        </span>
        <span
          className={
            compact
              ? "mt-1.5 max-w-36 text-[0.7rem] leading-4 text-page-ink-soft sm:text-xs"
              : "mt-2 max-w-56 text-xs leading-4 text-page-ink-soft sm:text-sm"
          }
        >
          At least {MIN_PHOTOS_FOR_BOOK} photos & videos to make a book.
        </span>
      </button>

      <button
        type="button"
        onClick={onAddFolder}
        className={`mt-3 w-full cursor-pointer text-center font-medium text-periwinkle underline decoration-page-line underline-offset-4 hover:text-periwinkle-deep ${
          compact ? "text-xs sm:text-sm" : "text-sm"
        }`}
      >
        or choose a folder
      </button>

      {hasMedia ? (
        <p
          className={`mt-3 text-center text-page-ink-soft ${
            compact ? "text-xs leading-4" : "text-sm leading-5"
          }`}
        >
          {readyCount.toLocaleString()} usable{" "}
          {readyCount === 1 ? "photo" : "photos"}
          <br />
          {videoCount.toLocaleString()} usable{" "}
          {videoCount === 1 ? "video" : "videos"}
        </p>
      ) : null}

      {processing ? (
        <p
          role="status"
          className={`mt-2 text-center text-page-ink-soft ${
            compact ? "text-xs" : "text-sm"
          }`}
        >
          Reading the rest of their album…
        </p>
      ) : remaining > 0 && hasMedia ? (
        <p className="mt-2 text-center text-xs text-page-ink-soft">
          {remaining.toLocaleString()} more photos & videos to start a book.
        </p>
      ) : mediaCount >= MIN_PHOTOS_FOR_BOOK ? (
        <p className="mt-2 text-center text-xs text-page-ink-soft">
          Press Next when you’re finished uploading.
        </p>
      ) : null}
    </>
  );
}

function PhotosSection({
  photos,
  onRemove,
}: {
  photos: AlbumTile[];
  onRemove: (id: string, kind: "photo" | "video") => void;
}) {
  const { main, duplicates, unusable } = splitPhotoTiles(photos);

  return (
    <section>
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h3 className="font-display text-lg text-page-ink sm:text-xl">Photos</h3>
        <p className="text-xs font-medium uppercase tracking-wide text-page-ink-faint">
          {main.length.toLocaleString()} · oldest first
        </p>
      </div>
      {main.length > 0 ? (
        <MediaGrid tiles={main} onRemove={onRemove} />
      ) : (
        <p className="text-sm text-page-ink-soft">
          Ready-to-print photos will show here. Open a folder below for shots we
          set aside.
        </p>
      )}
      {unusable.length > 0 ? (
        <AlbumFolder
          title="Too small or blurry"
          tone="petal"
          tiles={unusable}
          onRemove={onRemove}
          description={`${unusable.length.toLocaleString()} ${
            unusable.length === 1 ? "photo" : "photos"
          } that won’t hold up on the page — low-resolution, or too dark, washed out, or soft.`}
        />
      ) : null}
      {duplicates.length > 0 ? (
        <AlbumFolder
          title="Duplicates"
          tone="lavender"
          tiles={duplicates}
          onRemove={onRemove}
          description={`${duplicates.length.toLocaleString()} similar ${
            duplicates.length === 1 ? "shot" : "shots"
          } hidden from the book. We kept the sharpest of each burst so pages don’t repeat.`}
        />
      ) : null}
    </section>
  );
}

function AlbumFolder({
  title,
  tone,
  tiles,
  description,
  onRemove,
}: {
  title: string;
  tone: "lavender" | "petal";
  tiles: AlbumTile[];
  description: string;
  onRemove: (id: string, kind: "photo" | "video") => void;
}) {
  const previews = tiles.slice(0, 3);
  const chrome =
    tone === "petal"
      ? "border-petal bg-petal/35 open:bg-petal/25"
      : "border-lavender bg-lavender/35 open:bg-lavender/25";
  const divider = tone === "petal" ? "border-petal/80" : "border-lavender/80";
  const icon = tone === "petal" ? "text-page-ink" : "text-periwinkle";

  return (
    <details className={`group mt-4 rounded-2xl border-2 ${chrome}`}>
      <summary className="flex cursor-pointer list-none items-center gap-3 px-3 py-3 sm:px-4 [&::-webkit-details-marker]:hidden">
        <span className="relative h-12 w-14 shrink-0" aria-hidden>
          {previews.map((tile, index) => (
            // eslint-disable-next-line @next/next/no-img-element -- local object URL
            <img
              key={tile.id}
              src={tile.thumbUrl}
              alt=""
              className="absolute top-0 h-12 w-12 rounded-md object-cover ring-1 ring-white"
              style={{ left: index * 6, zIndex: previews.length - index }}
            />
          ))}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2 font-display text-base text-page-ink sm:text-lg">
            <Folder aria-hidden className={`h-4 w-4 ${icon}`} />
            {title}
          </span>
          <span className="mt-0.5 block text-xs leading-4 text-page-ink-soft">
            {description}
          </span>
        </span>
        <ChevronDown
          aria-hidden
          className="h-4 w-4 shrink-0 text-page-ink-soft transition-transform group-open:rotate-180"
        />
      </summary>
      <div className={`border-t px-3 py-3 sm:px-4 ${divider}`}>
        <MediaGrid tiles={tiles} onRemove={onRemove} />
      </div>
    </details>
  );
}

function MediaSection({
  title,
  count,
  tiles,
  onRemove,
}: {
  title: string;
  count: number;
  tiles: AlbumTile[];
  onRemove: (id: string, kind: "photo" | "video") => void;
}) {
  return (
    <section>
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h3 className="font-display text-lg text-page-ink sm:text-xl">{title}</h3>
        <p className="text-xs font-medium uppercase tracking-wide text-page-ink-faint">
          {count.toLocaleString()} · oldest first
        </p>
      </div>
      <MediaGrid tiles={tiles} onRemove={onRemove} />
    </section>
  );
}

function MediaGrid({
  tiles,
  onRemove,
}: {
  tiles: AlbumTile[];
  onRemove: (id: string, kind: "photo" | "video") => void;
}) {
  return (
    <div className="@container">
      <ul className="grid max-h-[calc(1.5*((100cqi-1rem)/3)+0.5rem)] grid-cols-3 gap-2 overflow-y-auto overscroll-contain pr-1 sm:max-h-[calc(1.5*((100cqi-1.5rem)/4)+0.5rem)] sm:grid-cols-4 md:max-h-[calc(1.5*((100cqi-2rem)/5)+0.5rem)] md:grid-cols-5 lg:max-h-[calc(1.5*((100cqi-2.5rem)/6)+0.5rem)] lg:grid-cols-6 xl:max-h-[calc(1.5*((100cqi-3rem)/7)+0.5rem)] xl:grid-cols-7">
        {tiles.map((tile) => (
          <li key={tile.id}>
            <MediaThumb tile={tile} onRemove={onRemove} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function MediaThumb({
  tile,
  onRemove,
}: {
  tile: AlbumTile;
  onRemove: (id: string, kind: "photo" | "video") => void;
}) {
  const status = photoPrintStatus(tile);
  const issue = printIssue(tile);
  const statusLabel =
    issue === "small"
      ? "Too small to print well"
      : issue === "quality"
        ? "Too dark, washed out, or soft to print well"
        : status === "duplicate"
          ? "Similar shot — hidden from the book"
          : undefined;

  return (
    <figure
      className="group relative aspect-square overflow-hidden rounded-lg bg-page-ink/10 ring-1 ring-page-ink/10"
      title={statusLabel}
    >
      {tile.kind === "video" && tile.previewUrl ? (
        <MutedLoop src={tile.previewUrl} poster={tile.thumbUrl} />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element -- local object URL
        <img
          src={tile.thumbUrl}
          alt=""
          className="h-full w-full object-cover"
        />
      )}
      {statusLabel ? <span className="sr-only">{statusLabel}</span> : null}
      {tile.kind === "video" ? (
        <span className="absolute bottom-1 left-1 rounded bg-page-ink/70 px-1.5 py-0.5 text-[0.65rem] font-medium text-white">
          Video
        </span>
      ) : null}
      {tile.capturedAt ? (
        <span className="sr-only">{formatDate(tile.capturedAt)}</span>
      ) : null}
      <button
        type="button"
        onClick={() => onRemove(tile.id, tile.kind)}
        className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-page-ink/75 text-white opacity-100 transition-opacity hover:bg-page-ink sm:opacity-0 sm:group-hover:opacity-100"
        aria-label={`Remove ${tile.kind} from album`}
      >
        <X aria-hidden className="h-3.5 w-3.5" strokeWidth={2.5} />
      </button>
    </figure>
  );
}

function MutedLoop({ src, poster }: { src: string; poster: string }) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    node.muted = true;
    node.defaultMuted = true;
    const play = () => {
      void node.play().catch(() => {});
    };
    play();
    node.addEventListener("loadeddata", play);
    node.addEventListener("canplay", play);
    return () => {
      node.removeEventListener("loadeddata", play);
      node.removeEventListener("canplay", play);
    };
  }, [src]);

  return (
    <video
      ref={ref}
      src={src}
      poster={poster}
      muted
      loop
      autoPlay
      playsInline
      preload="metadata"
      disablePictureInPicture
      controls={false}
      className="h-full w-full object-cover"
    />
  );
}

function formatDate(ms: number): string {
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(ms);
}
