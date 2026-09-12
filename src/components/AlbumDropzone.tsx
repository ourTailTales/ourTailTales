"use client";

import { useRef, useState, type DragEvent } from "react";

import { filesFromDataTransfer, isLikelyImage } from "@/lib/photo/process";

export function AlbumDropzone({
  onFiles,
}: {
  onFiles: (files: File[]) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isOver, setIsOver] = useState(false);
  const [isReading, setIsReading] = useState(false);

  const handleDrop = async (event: DragEvent<HTMLDivElement>): Promise<void> => {
    event.preventDefault();
    setIsOver(false);
    setIsReading(true);
    try {
      const files = await filesFromDataTransfer(event.dataTransfer);
      if (files.length > 0) onFiles(files);
    } finally {
      setIsReading(false);
    }
  };

  return (
    <div
      onDragOver={(event) => {
        event.preventDefault();
        setIsOver(true);
      }}
      onDragLeave={() => setIsOver(false)}
      onDrop={handleDrop}
      className={`group relative rounded-3xl border border-dashed p-8 text-center transition-colors sm:p-12 ${
        isOver
          ? "border-periwinkle bg-memory-blue shadow-lift"
          : "border-line bg-memory-blue/70 hover:border-periwinkle/70 hover:bg-memory-blue"
      }`}
    >
      <UploadIcon />
      <p className="mt-4 font-display text-2xl text-ink sm:text-[1.75rem]">
        Drop your pet&rsquo;s photo album here
      </p>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-ink-soft">
        Drag in a folder or select hundreds of photos at once. No account, no
        upload — everything is read right here on your device.
      </p>

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={isReading}
        className="mt-6 inline-flex items-center justify-center rounded-xl bg-periwinkle px-7 py-3 text-base font-semibold text-white shadow-lift transition-colors hover:bg-periwinkle-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-periwinkle disabled:opacity-60"
      >
        {isReading ? "Reading your album…" : "Select album"}
      </button>

      <p className="mt-4 text-xs font-medium text-ink-faint">
        JPEG, PNG, HEIC and more. 50 photos or 2,000 — the price never changes.
      </p>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="sr-only"
        onChange={(event) => {
          const files = Array.from(event.target.files ?? []).filter(isLikelyImage);
          event.target.value = "";
          if (files.length > 0) onFiles(files);
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
      className="mx-auto h-10 w-10 text-periwinkle"
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
