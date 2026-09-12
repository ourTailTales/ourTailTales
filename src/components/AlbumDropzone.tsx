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
      className={`group relative rounded-2xl border-2 border-dashed p-8 text-center transition-colors sm:p-12 ${
        isOver
          ? "border-tail bg-tail-wash/60"
          : "border-line bg-paper-deep/40 hover:border-tail/60"
      }`}
    >
      <p className="font-display text-2xl text-ink">
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
        className="mt-6 inline-flex items-center justify-center rounded-full bg-tail px-7 py-3 text-base font-medium text-paper shadow-lift transition-colors hover:bg-tail-deep disabled:opacity-60"
      >
        {isReading ? "Reading your album…" : "Select album"}
      </button>

      <p className="mt-4 text-xs text-ink-faint">
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
