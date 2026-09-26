"use client";

import { ArrowRight, Minus, Plus } from "lucide-react";
import { useState } from "react";

import { track } from "@/lib/analytics";
import {
  BASE_CHAPTERS,
  DEFAULT_CHAPTER_CAP,
  bookPrice,
  bookTier,
  chapterRateSummary,
  formatUsd,
  luluInteriorPages,
} from "@/lib/pricing";

/**
 * What the book would be, before a word of it is written.
 *
 * The length of a book used to be a fixed five chapters, so there was nothing
 * to ask: everyone got the same book at the same price. Now the album decides
 * how many periods it holds, and a long camera roll can hold a great many —
 * which means the price is decided by the album too, and the first time anyone
 * saw it was after five to fifty paid model calls had already been spent
 * writing chapters at a price nobody had agreed to.
 *
 * So it is asked here. Grouping photographs by date is free and has already
 * happened; nothing past this screen is free. The number can be moved, the
 * price moves with it, and the album's full length is offered in words rather
 * than assumed.
 */
export function BookSizeStep({
  recommended,
  available,
  petName,
  photoCount,
  onConfirm,
}: {
  /** What the album proposes, capped at the default. */
  recommended: number;
  /** Everything the album has periods for. */
  available: number;
  petName: string;
  photoCount: number;
  onConfirm: (chapters: number) => void;
}) {
  const [chapters, setChapters] = useState(recommended);

  const tier = bookTier(chapters);
  const price = bookPrice(chapters);
  const name = petName.trim();
  const moreAvailable = available > DEFAULT_CHAPTER_CAP && chapters < available;

  const move = (by: number): void =>
    setChapters((current) =>
      Math.min(Math.max(current + by, BASE_CHAPTERS), available),
    );

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 py-6">
      <header>
        <h1 className="font-display text-3xl text-page-ink sm:text-4xl">
          {name ? `${name}’s book` : "Your book"}
        </h1>
        <p className="mt-2 text-sm leading-6 text-page-ink-soft">
          We read {photoCount.toLocaleString()}{" "}
          {photoCount === 1 ? "photo" : "photos"} and found{" "}
          {available === 1 ? "one period" : `${available} periods`} in{" "}
          {name ? `${name}’s` : "their"} life. How much of it should the book
          cover?
        </p>
      </header>

      <section className="rounded-2xl border border-page-line bg-white/95 p-5 sm:p-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-page-ink-faint">
              {tier.label}
            </p>
            <p className="mt-1 font-display text-2xl text-page-ink">
              {chapters} {chapters === 1 ? "chapter" : "chapters"}
            </p>
            <p className="mt-1 text-sm text-page-ink-soft">
              Up to {luluInteriorPages(chapters)} printed pages
            </p>
          </div>
          <p className="font-display text-3xl text-page-ink">{formatUsd(price)}</p>
        </div>

        <div className="mt-5 flex items-center gap-3">
          <Stepper
            label="One chapter fewer"
            onClick={() => move(-1)}
            disabled={chapters <= BASE_CHAPTERS}
          >
            <Minus aria-hidden className="size-4" strokeWidth={2.5} />
          </Stepper>

          <input
            type="range"
            min={BASE_CHAPTERS}
            max={Math.max(available, BASE_CHAPTERS)}
            value={chapters}
            aria-label="Chapters in the book"
            onChange={(event) => setChapters(Number(event.target.value))}
            disabled={available <= BASE_CHAPTERS}
            className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-page-line accent-periwinkle disabled:cursor-not-allowed disabled:opacity-50"
          />

          <Stepper
            label="One chapter more"
            onClick={() => move(1)}
            disabled={chapters >= available}
          >
            <Plus aria-hidden className="size-4" strokeWidth={2.5} />
          </Stepper>
        </div>

        {/* The rates read out of the tier table rather than written here, so
            the page cannot go on quoting a price that has moved. */}
        <p className="mt-3 text-xs leading-5 text-page-ink-faint">
          {formatUsd(bookPrice(BASE_CHAPTERS))} for the first {BASE_CHAPTERS}{" "}
          chapters, then {chapterRateSummary()}. Shipping is quoted at checkout,
          and nothing is charged until you order a copy.
        </p>

        {/* The album's full length, offered rather than assumed. */}
        {moreAvailable ? (
          <button
            type="button"
            onClick={() => setChapters(available)}
            className="mt-4 w-full rounded-xl border border-periwinkle/40 bg-periwinkle-wash/40 px-4 py-3 text-left text-sm text-periwinkle-deep transition-colors hover:border-periwinkle"
          >
            Your photos have enough for {available} chapters — include them all?{" "}
            <span className="font-semibold">({formatUsd(bookPrice(available))})</span>
          </button>
        ) : null}
      </section>

      <div className="flex flex-col items-center gap-3">
        <button
          type="button"
          onClick={() => {
            track("book_size_chosen", {
              chapters,
              proposed: recommended,
              available,
              price,
              tier: tier.id,
            });
            onConfirm(chapters);
          }}
          className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-periwinkle px-6 text-base font-semibold text-white shadow-lift transition-colors hover:bg-periwinkle-deep sm:w-auto sm:px-10"
        >
          Write {name ? `${name}’s` : "the"} book
          <ArrowRight aria-hidden className="size-4" />
        </button>
        <p className="text-xs text-page-ink-faint">
          You can change every page afterwards, and read the first pages free.
        </p>
      </div>
    </div>
  );
}

function Stepper({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className="flex size-10 shrink-0 items-center justify-center rounded-full border border-page-line bg-white text-page-ink transition-colors hover:border-periwinkle disabled:opacity-40"
    >
      {children}
    </button>
  );
}
