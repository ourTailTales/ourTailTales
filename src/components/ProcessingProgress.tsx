"use client";

import type { ProcessingProgressState } from "@/types/photo";

const PHASE_COPY: Record<ProcessingProgressState["phase"], string> = {
  reading: "Reading photo details",
  thumbnails: "Building previews",
  deduplicating: "Finding duplicates",
  sorting: "Sorting the timeline",
  done: "Finished",
};

export function ProcessingProgress({
  progress,
  onCancel,
}: {
  progress: ProcessingProgressState;
  onCancel: () => void;
}) {
  const percent =
    progress.total === 0
      ? 0
      : Math.min(100, Math.round((progress.processed / progress.total) * 100));

  return (
    <section className="animate-fade-up rounded-2xl border border-line bg-paper-deep/40 p-8">
      <h2 className="font-display text-2xl text-ink">
        Organizing {progress.total.toLocaleString()} photos
      </h2>
      <p className="mt-2 text-sm text-ink-soft">
        {PHASE_COPY[progress.phase]} — {progress.processed.toLocaleString()} of{" "}
        {progress.total.toLocaleString()}. A few at a time, so your browser stays
        responsive.
      </p>

      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        aria-label="Album processing progress"
        className="mt-5 h-2 overflow-hidden rounded-full bg-paper-edge"
      >
        <div
          className="h-full rounded-full bg-tail transition-[width] duration-200 ease-out"
          style={{ width: `${percent}%` }}
        />
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-ink-faint">
          {progress.failed > 0
            ? `${progress.failed.toLocaleString()} file${progress.failed === 1 ? "" : "s"} could not be read and were skipped.`
            : "Your original files are never uploaded or changed."}
        </p>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-full border border-line px-4 py-1.5 text-sm text-ink-soft transition-colors hover:border-tail hover:text-tail-deep"
        >
          Cancel
        </button>
      </div>
    </section>
  );
}
