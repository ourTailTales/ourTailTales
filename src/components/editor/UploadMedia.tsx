"use client";

import { FolderOpen, FolderUp } from "lucide-react";
import { useRef, useState, type ChangeEvent } from "react";

import { MediaLibraryModal } from "@/components/editor/MediaLibraryModal";
import { isLikelyMedia } from "@/lib/photo/process";
import { MIN_PHOTOS_FOR_BOOK } from "@/lib/pricing";
import type { AlbumVideoPreview } from "@/store/useOurTailTalesStore";
import type { PhotoAsset } from "@/types/photo";

/**
 * Where the album comes in.
 *
 * This used to be a modal: a white card on a blurred backdrop, with a close
 * button, sitting over the screen it belonged to. It is not an interruption,
 * it is the next thing you do, so it is now flat on the page itself. No
 * dialog, no card, no panel. The text sits on the background and the only
 * outlined thing is the drop target, which has to be visible to be a target.
 *
 * The address is asked for here, beside the upload, rather than before it or
 * after the book exists. Before it, there is nothing to have an address for
 * yet; after it, the book has already been made for someone we cannot reach if
 * they close the tab. Typing it while the photos are being read costs nothing,
 * and it is what the finished book gets sent to.
 */
export function UploadMedia({
  onFiles,
  processing,
  email,
  onEmailChange,
  onCancel,
  heading,
  photoCount,
  photos,
  videos,
  onRemovePhoto,
  onRemoveVideo,
}: {
  onFiles: (files: File[]) => void;
  processing: boolean;
  email: string | null;
  onEmailChange: (email: string) => void;
  /** Offered only where there is something to go back to. */
  onCancel?: () => void;
  heading?: string;
  /** Usable photographs already in the album, for the "N more to go" line. */
  photoCount: number;
  /** What has been dropped in so far, for the folder button and its modal. */
  photos: PhotoAsset[];
  videos: AlbumVideoPreview[];
  onRemovePhoto: (id: string) => void;
  onRemoveVideo: (id: string) => void;
}) {
  const photosRef = useRef<HTMLInputElement>(null);
  const folderRef = useRef<HTMLInputElement>(null);
  const [draftEmail, setDraftEmail] = useState(email ?? "");
  const [libraryOpen, setLibraryOpen] = useState(false);

  const totalMedia = photos.length + videos.length;
  const missing = Math.max(0, MIN_PHOTOS_FOR_BOOK - photoCount);

  const [emailTouched, setEmailTouched] = useState(false);
  // Empty is not wrong here — the address may already be on file from
  // earlier in the funnel, or given after the book is done. Only a typo,
  // something typed and not a real address, is worth flagging.
  const emailValid = draftEmail.trim() === "" || isLikelyEmail(draftEmail.trim());

  const emit = (list: FileList | null): void => {
    const files = Array.from(list ?? []).filter(isLikelyMedia);
    if (files.length > 0) onFiles(files);
  };

  const handleChange = (event: ChangeEvent<HTMLInputElement>): void => {
    emit(event.target.files);
    event.target.value = "";
  };

  return (
    <div className="relative mx-auto w-full max-w-lg text-center">
      {totalMedia > 0 ? (
        <button
          type="button"
          onClick={() => setLibraryOpen(true)}
          aria-label={`View and manage your ${totalMedia} uploaded ${totalMedia === 1 ? "item" : "items"}`}
          className="absolute right-0 top-0 inline-flex size-11 items-center justify-center rounded-full border border-page-line bg-white text-page-ink-soft transition-colors hover:border-periwinkle hover:text-periwinkle-deep"
        >
          <FolderOpen aria-hidden className="size-5" />
          <span className="absolute -right-1.5 -top-1.5 flex min-w-5 items-center justify-center rounded-full bg-periwinkle px-1 text-[0.65rem] font-semibold leading-5 text-white">
            {totalMedia}
          </span>
        </button>
      ) : null}

      <h2 className="font-display text-2xl text-page-ink sm:text-3xl">
        {heading ?? "Now their photos"}
      </h2>
      <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-page-ink-soft">
        {missing === 0
          ? "That's enough to start. Add more any time."
          : photoCount === 0
            ? `Add at least ${MIN_PHOTOS_FOR_BOOK} photos and videos. We sort them into chapters for you.`
            : `${missing} more photo${missing === 1 ? "" : "s"} and we can start sorting them into chapters.`}
      </p>

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

      <button
        type="button"
        onClick={() => photosRef.current?.click()}
        className="mt-7 flex aspect-2/1 w-full cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dotted border-page-line bg-transparent text-center transition-colors hover:border-periwinkle"
      >
        <FolderUp
          aria-hidden
          className="h-8 w-8 text-periwinkle"
          strokeWidth={1.75}
        />
        <span className="text-sm font-semibold text-page-ink">
          {processing ? "Reading…" : "Choose photos and videos"}
        </span>
        <span className="text-xs text-page-ink-faint">
          or drag them in anywhere on this page
        </span>
      </button>

      <div className="mt-3 flex items-center justify-center">
        <button
          type="button"
          onClick={() => folderRef.current?.click()}
          className="text-sm font-medium text-periwinkle underline decoration-page-line underline-offset-4 hover:text-periwinkle-deep"
        >
          or choose a whole folder
        </button>
      </div>

      <label className="mx-auto mt-9 block max-w-sm">
        <span className="block text-sm font-medium text-page-ink">
          Where should we send the finished book?
        </span>
        <input
          type="email"
          inputMode="email"
          autoComplete="email"
          value={draftEmail}
          aria-invalid={emailTouched && !emailValid}
          aria-describedby={emailTouched && !emailValid ? "uploadEmailError" : undefined}
          onChange={(event) => setDraftEmail(event.target.value)}
          onBlur={() => {
            setEmailTouched(true);
            const trimmed = draftEmail.trim();
            if (trimmed && trimmed !== email && isLikelyEmail(trimmed)) {
              onEmailChange(trimmed);
            }
          }}
          placeholder="you@example.com"
          className="mt-2 min-h-11 w-full border-0 border-b border-page-line bg-transparent px-0 pb-1 text-center text-sm text-page-ink shadow-none outline-none transition-colors placeholder:text-page-ink-faint focus:border-periwinkle focus:outline-none"
        />
        {emailTouched && !emailValid ? (
          <p id="uploadEmailError" role="alert" className="mt-2 text-xs text-red-600">
            That doesn&rsquo;t look like a full email address, so we
            haven&rsquo;t saved it yet.
          </p>
        ) : null}
      </label>

      {onCancel ? (
        <div className="mt-7">
          <button
            type="button"
            onClick={onCancel}
            className="text-xs text-page-ink-faint underline decoration-page-line underline-offset-4 hover:text-periwinkle-deep"
          >
            Back
          </button>
        </div>
      ) : null}

      {libraryOpen ? (
        <MediaLibraryModal
          photos={photos}
          videos={videos}
          onRemovePhoto={onRemovePhoto}
          onRemoveVideo={onRemoveVideo}
          onClose={() => setLibraryOpen(false)}
        />
      ) : null}
    </div>
  );
}

/** Loose on purpose — this only guards against a typo, never rejects a real address. */
function isLikelyEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}
