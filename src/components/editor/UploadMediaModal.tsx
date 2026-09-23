"use client";

import { FolderUp, X } from "lucide-react";
import { useEffect, useRef, useState, type ChangeEvent } from "react";

import { isLikelyMedia } from "@/lib/photo/process";
import { MIN_PHOTOS_FOR_BOOK } from "@/lib/pricing";

/**
 * First thing a customer sees on landing in the book editor with no media
 * yet — a focused prompt to upload their pet's photos & videos, rather than
 * making them notice the small "Add photos" control tucked into the Cover
 * panel. Dropping files anywhere on the page still works: this is mounted
 * inside BookEditor's full-page dropzone, so drops just bubble past it.
 *
 * The address is asked for here, beside the upload, rather than before it or
 * after the book exists. Before it, there is nothing to have an address for
 * yet; after it, the book has already been made for someone we cannot reach if
 * they close the tab. Typing it while the photos are being read costs nothing,
 * and it is what the finished book gets sent to.
 */
export function UploadMediaModal({
  onFiles,
  onClose,
  processing,
  email,
  onEmailChange,
}: {
  onFiles: (files: File[]) => void;
  onClose: () => void;
  processing: boolean;
  email: string | null;
  onEmailChange: (email: string) => void;
}) {
  const photosRef = useRef<HTMLInputElement>(null);
  const folderRef = useRef<HTMLInputElement>(null);
  const [draftEmail, setDraftEmail] = useState(email ?? "");

  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const emit = (list: FileList | null): void => {
    const files = Array.from(list ?? []).filter(isLikelyMedia);
    if (files.length > 0) onFiles(files);
  };

  const handleChange = (event: ChangeEvent<HTMLInputElement>): void => {
    emit(event.target.files);
    event.target.value = "";
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="uploadMediaTitle"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-ink/40 backdrop-blur-sm"
      />

      <div className="relative w-full max-w-lg rounded-2xl border border-line bg-white p-6 shadow-book sm:p-8">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full text-ink-faint transition-colors hover:bg-ink/5 hover:text-ink"
        >
          <X aria-hidden className="h-4 w-4" strokeWidth={2.25} />
        </button>

        <h2 id="uploadMediaTitle" className="pr-8 font-display text-2xl text-ink">
          Start with their photos
        </h2>
        <p className="mt-2 pr-8 text-sm leading-6 text-ink-soft">
          Upload at least {MIN_PHOTOS_FOR_BOOK} photos & videos and
          we&rsquo;ll sort them into chapters automatically.
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
          className="mt-6 flex aspect-[2/1] w-full cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dotted border-line bg-lavender/20 text-center transition-colors hover:border-periwinkle hover:bg-lavender/35"
        >
          <FolderUp
            aria-hidden
            className="h-8 w-8 text-periwinkle"
            strokeWidth={1.75}
          />
          <span className="text-sm font-semibold text-ink">
            {processing ? "Reading…" : "Choose photos & videos"}
          </span>
          <span className="text-xs text-ink-faint">
            or drag them in anywhere on this page
          </span>
        </button>

        <div className="mt-3 flex items-center justify-center">
          <button
            type="button"
            onClick={() => folderRef.current?.click()}
            className="text-sm font-medium text-periwinkle underline decoration-line underline-offset-4 hover:text-periwinkle-deep"
          >
            or choose a whole folder
          </button>
        </div>

        <label className="mt-6 block border-t border-line pt-5">
          <span className="block text-sm font-medium text-ink">
            Where should we send the finished book?
          </span>
          <input
            type="email"
            inputMode="email"
            autoComplete="email"
            value={draftEmail}
            onChange={(event) => setDraftEmail(event.target.value)}
            onBlur={() => {
              const trimmed = draftEmail.trim();
              if (trimmed && trimmed !== email) onEmailChange(trimmed);
            }}
            placeholder="you@example.com"
            className="mt-1.5 min-h-11 w-full rounded-xl border border-line px-3 text-sm text-ink outline-none focus:border-periwinkle"
          />
          <span className="mt-1.5 block text-xs text-ink-faint">
            Your photos stay on this device. Only the finished book is sent.
          </span>
        </label>
      </div>
    </div>
  );
}
