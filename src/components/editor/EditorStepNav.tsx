"use client";

import { ArrowLeft, ArrowRight } from "lucide-react";

export function EditorStepNav({
  canPrev,
  canNext,
  nextLabel = "Next",
  showNext = true,
  onPrev,
  onNext,
}: {
  canPrev: boolean;
  canNext: boolean;
  nextLabel?: string;
  showNext?: boolean;
  onPrev: () => void;
  onNext: () => void;
}) {
  return (
    <div className="relative z-10 flex items-center justify-end gap-3 px-5 pb-8 pt-4 sm:px-8 sm:pb-10">
      {canPrev ? (
        <button
          type="button"
          onClick={onPrev}
          className="inline-flex min-h-12 items-center gap-2 rounded-xl border border-page-line bg-white px-5 py-3 text-base font-semibold text-page-ink shadow-lift transition-colors hover:border-periwinkle hover:text-periwinkle-deep"
        >
          <ArrowLeft aria-hidden className="h-5 w-5" strokeWidth={2.25} />
          Previous
        </button>
      ) : null}
      {showNext ? (
        <button
          type="button"
          onClick={onNext}
          disabled={!canNext}
          className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-periwinkle px-6 py-3 text-base font-semibold text-white shadow-lift transition-colors hover:bg-periwinkle-deep disabled:cursor-not-allowed disabled:bg-page-ink/25 disabled:shadow-none"
        >
          {nextLabel}
          <ArrowRight aria-hidden className="h-5 w-5" strokeWidth={2.25} />
        </button>
      ) : null}
    </div>
  );
}
