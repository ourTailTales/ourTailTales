"use client";

import { Lock } from "lucide-react";

import { possessivePetName } from "@/lib/book/pagination";
import { TEASER_PAGE_COUNT } from "@/lib/book/teaser";

/**
 * What a signed-out reader meets at page eleven.
 *
 * The whole book already exists — it was written before they got here — so
 * this says so plainly instead of pretending there is more work to do. The
 * ask is small and the reason for it is true: an account is what lets the book
 * exist somewhere other than this browser tab.
 */
export function LockedWall({
  petName,
  hiddenPages,
  hiddenChapters,
  onUnlock,
  compact = false,
}: {
  petName: string;
  hiddenPages: number;
  hiddenChapters: number;
  onUnlock: () => void;
  compact?: boolean;
}) {
  const name = petName.trim();
  const chapters =
    hiddenChapters === 1 ? "1 more chapter" : `${hiddenChapters} more chapters`;
  const pages = hiddenPages === 1 ? "1 more page" : `${hiddenPages} more pages`;

  return (
    <div
      className={`rounded-2xl border border-periwinkle/25 bg-white/95 ${
        compact ? "p-5" : "p-6 sm:p-7"
      }`}
    >
      <span className="inline-flex items-center gap-1.5 rounded-full bg-periwinkle-wash/60 px-2.5 py-1 text-[0.7rem] font-semibold tracking-wide text-periwinkle-deep uppercase">
        <Lock aria-hidden className="size-3" />
        Page {TEASER_PAGE_COUNT} of your free preview
      </span>

      <h2 className="mt-3 font-display text-2xl leading-tight text-page-ink">
        {name ? `${possessivePetName(name)} story continues` : "The story continues"}
      </h2>

      <p className="mt-2 max-w-prose text-sm leading-6 text-page-ink-soft">
        {chapters} — {pages} — are already written. Make an account and the whole
        book opens, stays in your library, and follows you to any device. Then you
        can change any of it: the cover, the chapters, every photo.
      </p>

      <button
        type="button"
        onClick={onUnlock}
        className="mt-5 inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-periwinkle px-6 text-base font-semibold text-white shadow-lift transition-colors hover:bg-periwinkle-deep sm:w-auto"
      >
        Read the rest of the book
      </button>

      <p className="mt-3 text-xs text-page-ink-faint">
        Free. Your photos stay on your own device either way.
      </p>
    </div>
  );
}
