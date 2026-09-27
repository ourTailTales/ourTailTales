"use client";

import { useMemo, useState } from "react";

import { track } from "@/lib/analytics";
import {
  CHAPTER_TIERS,
  bookPrice,
  chaptersForSpan,
  chaptersForTier,
  photoRangeForTier,
  photosForTier,
  recommendedTier,
  tierIsAvailable,
  type ChapterTier,
} from "@/lib/pricing";
import { summarizeAlbum, useOurTailTalesStore } from "@/store/useOurTailTalesStore";

/**
 * How long a book to make, asked once, under the album they just dropped.
 *
 * This used to be decided for them — five chapters at first, then as many as
 * the photographs would support. Both were guesses made in place of a
 * question, and the second one quietly gave away a fifty-chapter book's worth
 * of writing on every large album.
 *
 * So it is asked, but it is not asked cold: the album's own span picks the
 * answer, one chapter for each year between the first photograph and the
 * last. A puppy's first eighteen months and a dog of sixteen years are not
 * the same book, and the dates are the only thing we have that knows which
 * one is on the table. What the customer does here is agree with it, or
 * choose a shorter or longer book knowing exactly what each costs.
 */
export function AlbumSize() {
  const photos = useOurTailTalesStore((state) => state.photos);
  const petName = useOurTailTalesStore((state) => state.meta.petName);
  const chooseBookSize = useOurTailTalesStore((state) => state.chooseBookSize);

  const album = useMemo(() => summarizeAlbum(photos), [photos]);
  const usablePhotoCount = album.placeable;

  const wantedChapters = chaptersForSpan(album.firstAt, album.lastAt);
  const recommended = useMemo(
    () =>
      recommendedTier({
        firstAt: album.firstAt,
        lastAt: album.lastAt,
        usablePhotoCount,
      }),
    [album.firstAt, album.lastAt, usablePhotoCount],
  );

  const [picked, setPicked] = useState<ChapterTier["id"]>(recommended.id);
  const chosen =
    CHAPTER_TIERS.find((tier) => tier.id === picked) ?? recommended;
  const chapters = chaptersForTier(chosen, { wantedChapters, usablePhotoCount });

  const name = petName.trim();
  const years = spanInYears(album.firstAt, album.lastAt);

  return (
    <section
      aria-labelledby="album-size-heading"
      className="mx-auto w-full max-w-3xl animate-fade-up"
    >
      <h2
        id="album-size-heading"
        className="font-display text-center text-2xl leading-tight text-page-ink sm:text-3xl"
      >
        How much of {name ? `${name}’s` : "their"} story?
      </h2>

      <ul className="mt-6 grid grid-cols-3 gap-3">
        {CHAPTER_TIERS.map((tier) => (
          <TierChoice
            key={tier.id}
            tier={tier}
            selected={tier.id === chosen.id}
            recommended={tier.id === recommended.id}
            available={tierIsAvailable(tier, usablePhotoCount)}
            usablePhotoCount={usablePhotoCount}
            wantedChapters={wantedChapters}
            onPick={() => setPicked(tier.id)}
          />
        ))}
      </ul>

      <div className="mt-6 flex flex-col items-center gap-3">
        <button
          type="button"
          onClick={() => {
            track("book_size_chosen", {
              chapters,
              price: bookPrice(chapters),
              tier: chosen.id,
              recommended: chosen.id === recommended.id,
            });
            chooseBookSize(chapters);
          }}
          className="inline-flex min-h-13 w-full max-w-sm items-center justify-center rounded-xl bg-periwinkle px-6 text-base font-semibold text-white shadow-lift transition-all duration-300 hover:bg-periwinkle-deep"
        >
          Confirm and write the book
        </button>
        <p className="text-xs text-page-ink-faint">
          Reading it is free. You only pay if you want it printed.
        </p>
      </div>
    </section>
  );
}

function TierChoice({
  tier,
  selected,
  recommended,
  available,
  usablePhotoCount,
  wantedChapters,
  onPick,
}: {
  tier: ChapterTier;
  selected: boolean;
  recommended: boolean;
  /** Their album holds enough photographs to fill a book this long. */
  available: boolean;
  usablePhotoCount: number;
  wantedChapters: number;
  onPick: () => void;
}) {
  const chapters = chaptersForTier(tier, { wantedChapters, usablePhotoCount });
  const photoRange = photoRangeForTier(tier);

  return (
    <li>
      <button
        type="button"
        onClick={onPick}
        disabled={!available}
        aria-pressed={selected}
        className={`flex w-full flex-col items-center gap-1 rounded-2xl border p-4 text-center transition-colors ${
          selected
            ? "border-periwinkle bg-periwinkle-wash/40"
            : "border-page-line bg-white hover:border-periwinkle/50"
        } ${available ? "" : "cursor-not-allowed opacity-55"}`}
      >
        <span className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1">
          <span className="font-display text-lg font-bold text-page-ink">
            {tier.name}
          </span>
          {recommended && available ? (
            <span className="rounded-full bg-periwinkle/15 px-2 py-0.5 text-[0.7rem] font-semibold text-periwinkle-deep">
              Fits your album
            </span>
          ) : null}
        </span>
        {!available ? (
          <span className="mt-1 block text-sm leading-6 text-page-ink-soft">
            Needs {photosForTier(tier)} photos, you have {usablePhotoCount}.
          </span>
        ) : null}
        <span className="mt-1 block font-display text-xl font-bold text-page-ink">
          {photoRange.min}&ndash;{photoRange.max}
        </span>
        <span className="block text-xs text-page-ink-faint">photos total</span>
        {available ? (
          <span className="mt-1 block text-xs text-page-ink-soft">
            {chapters} {chapters === 1 ? "chapter" : "chapters"} for your book
          </span>
        ) : null}
      </button>
    </li>
  );
}

/** Whole years between the first photograph and the last, or null if undated. */
function spanInYears(firstAt: number | null, lastAt: number | null): number | null {
  if (firstAt === null || lastAt === null || lastAt < firstAt) return null;
  const years = Math.round((lastAt - firstAt) / (365.2425 * 24 * 60 * 60 * 1000));
  return Math.max(1, years);
}
