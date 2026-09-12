"use client";

import { useId, useRef, useState, type MouseEvent } from "react";

import { filesFromDataTransfer, isLikelyImage } from "@/lib/photo/process";

export function HeroUploadZone({
  onFiles,
  disabled = false,
  isOver,
  onDragState,
  onInteract,
}: {
  onFiles: (files: File[]) => void;
  disabled?: boolean;
  isOver: boolean;
  onDragState: (over: boolean) => void;
  /** Called when the user engages upload controls (locks the book open). */
  onInteract?: () => void;
}) {
  const fileInputId = useId();
  const folderRef = useRef<HTMLInputElement>(null);
  const [reading, setReading] = useState(false);

  const busy = disabled || reading;

  const emit = (list: FileList | File[] | null): void => {
    const files = Array.from(list ?? []).filter(isLikelyImage);
    if (files.length > 0) onFiles(files);
  };

  const openFolder = (event: MouseEvent<HTMLButtonElement>): void => {
    event.preventDefault();
    event.stopPropagation();
    if (busy) return;
    onInteract?.();
    window.setTimeout(() => folderRef.current?.click(), 0);
  };

  return (
    <div
      className={`relative z-10 flex h-full min-h-[12rem] flex-col overflow-hidden rounded-[12px] transition-[background-color,box-shadow] duration-200 ${
        isOver
          ? "bg-memory-blue shadow-[inset_0_0_0_1.5px_var(--color-periwinkle)]"
          : "bg-memory-blue/45 shadow-[inset_0_0_0_1px_rgb(213_220_235/0.9)]"
      } ${busy ? "pointer-events-none opacity-55" : ""}`}
      onDragEnter={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onInteract?.();
        onDragState(true);
      }}
      onDragOver={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onInteract?.();
        onDragState(true);
      }}
      onDragLeave={(event) => {
        event.preventDefault();
        onDragState(false);
      }}
      onDrop={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onDragState(false);
        void (async () => {
          setReading(true);
          try {
            const files = await filesFromDataTransfer(event.dataTransfer);
            if (files.length > 0) onFiles(files);
          } finally {
            setReading(false);
          }
        })();
      }}
    >
      <label
        htmlFor={busy ? undefined : fileInputId}
        onClick={() => {
          if (!busy) onInteract?.();
        }}
        className={`flex h-full cursor-pointer flex-col justify-center px-3 pb-10 pt-4 text-center outline-none sm:px-4 sm:pb-11 sm:pt-5 ${
          busy
            ? "cursor-default"
            : "hover:bg-memory-blue/20 focus-visible:shadow-[inset_0_0_0_2px_var(--color-periwinkle)]"
        }`}
      >
        <UploadIcon />
        <p className="mt-3 font-display text-xl leading-snug text-ink sm:text-2xl">
          Start with their photos
        </p>
        <p className="mx-auto mt-2 max-w-[15.5rem] text-sm leading-5 text-ink-soft">
          Drop their album here or choose photos from your device.
        </p>
        <span className="mx-auto mt-4 inline-flex rounded-xl bg-periwinkle px-5 py-2.5 text-sm font-semibold text-white shadow-lift">
          {reading ? "Reading…" : "Choose photos"}
        </span>
        <p className="mt-3 text-[11px] font-medium leading-4 text-ink-faint">
          Stays on your device. JPEG, PNG, HEIC and more.
        </p>
      </label>

      <button
        type="button"
        disabled={busy}
        onClick={openFolder}
        className="absolute bottom-2.5 left-1/2 z-20 -translate-x-1/2 text-xs font-medium text-periwinkle underline decoration-line underline-offset-4 transition-colors hover:text-periwinkle-deep disabled:opacity-60"
      >
        or choose a folder
      </button>

      <input
        id={fileInputId}
        type="file"
        accept="image/*"
        multiple
        disabled={busy}
        className="sr-only"
        tabIndex={-1}
        onChange={(event) => {
          emit(event.target.files);
          event.target.value = "";
        }}
      />
      <input
        ref={folderRef}
        type="file"
        {...({ webkitdirectory: "", directory: "" } as object)}
        multiple
        disabled={busy}
        className="sr-only"
        tabIndex={-1}
        onChange={(event) => {
          emit(event.target.files);
          event.target.value = "";
        }}
      />
    </div>
  );
}

function UploadIcon() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      className="mx-auto h-8 w-8 text-periwinkle"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <circle cx="8.5" cy="10" r="1.5" />
      <path d="m21 15-4.5-4.5L9 18" />
    </svg>
  );
}
