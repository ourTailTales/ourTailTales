"use client";

import { FolderUp } from "lucide-react";
import { useRef, type ChangeEvent } from "react";

import { isLikelyMedia } from "@/lib/photo/process";
import { MIN_PHOTOS_FOR_BOOK } from "@/lib/pricing";

/**
 * Single "keep adding media" affordance for the editor. Sits under the
 * Cover panel's Text/Media tabs instead of a separate gallery — the Media
 * tab already shows the photo picker, so this only needs to get new files
 * in, not redisplay them.
 *
 * `compact` is the same control inside a panel that is already a list of
 * photographs — under the photos on a page, say. There the framed box and the
 * album's running totals are noise: the photographs are right there to count,
 * and what is needed is the one button that adds more.
 */
export function AddMediaControl({
  onFiles,
  processing,
  readyCount,
  videoCount,
  compact = false,
  photosOnly = false,
}: {
  onFiles: (files: File[]) => void;
  processing: boolean;
  readyCount: number;
  videoCount: number;
  compact?: boolean;
  /** Photographs alone — videos are added in the page's Videos tab. */
  photosOnly?: boolean;
}) {
  const photosRef = useRef<HTMLInputElement>(null);
  const folderRef = useRef<HTMLInputElement>(null);

  const emit = (list: FileList | null): void => {
    const files = Array.from(list ?? []).filter(isLikelyMedia);
    if (files.length > 0) onFiles(files);
  };

  const handleChange = (event: ChangeEvent<HTMLInputElement>): void => {
    emit(event.target.files);
    event.target.value = "";
  };

  const mediaCount = readyCount + videoCount;
  const remaining = Math.max(0, MIN_PHOTOS_FOR_BOOK - mediaCount);
  const hasMedia = mediaCount > 0;

  return (
    <div
      className={
        compact
          ? "flex flex-col gap-1"
          : "flex flex-col gap-3 rounded-lg border border-dashed border-line bg-lavender/20 p-3"
      }
    >
      <input
        ref={photosRef}
        type="file"
        accept={photosOnly ? "image/*" : "image/*,video/*"}
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

      <div className="flex flex-col items-center gap-2">
        <button
          type="button"
          onClick={() => photosRef.current?.click()}
          className="inline-flex min-h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-md bg-periwinkle px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-periwinkle-deep"
        >
          <FolderUp aria-hidden className="h-4 w-4" strokeWidth={2.25} />
          {processing ? "Reading…" : photosOnly ? "Add photos" : "Add photos & videos"}
        </button>
        <button
          type="button"
          onClick={() => folderRef.current?.click()}
          className={
            compact
              ? "min-h-9 cursor-pointer px-2 text-center text-xs font-medium text-periwinkle underline decoration-line underline-offset-4 hover:text-periwinkle-deep"
              : "min-h-11 cursor-pointer px-2 text-center text-sm font-medium text-periwinkle underline decoration-line underline-offset-4 hover:text-periwinkle-deep"
          }
        >
          or choose a folder
        </button>
      </div>

      {compact ? null : (
        <p className="text-center text-xs leading-5 text-ink-soft">
          {hasMedia ? (
            <>
              {readyCount.toLocaleString()} usable{" "}
              {readyCount === 1 ? "photo" : "photos"} ·{" "}
              {videoCount.toLocaleString()} usable{" "}
              {videoCount === 1 ? "video" : "videos"}
              {remaining > 0
                ? ` · ${remaining.toLocaleString()} more to start a book`
                : ""}
            </>
          ) : (
            <>At least {MIN_PHOTOS_FOR_BOOK} photos & videos to make a book.</>
          )}
        </p>
      )}
    </div>
  );
}
