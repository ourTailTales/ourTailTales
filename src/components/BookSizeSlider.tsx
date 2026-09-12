"use client";

import {
  BASE_CHAPTERS,
  FIXED_INTERIOR_PAGES,
  MAX_CHAPTERS,
  MIN_PHOTOS_PER_CHAPTER,
  bookSpec,
  formatUsd,
} from "@/lib/pricing";

/**
 * Book size, and therefore price, depends only on chapter count. The number of
 * photos a customer uploaded never changes what they pay.
 */
export function BookSizeSlider({
  chapterCount,
  maxChapters,
  placeablePhotos,
  onChange,
  onConfirm,
  onBack,
}: {
  chapterCount: number;
  maxChapters: number;
  placeablePhotos: number;
  onChange: (count: number) => void;
  onConfirm: () => void;
  onBack: () => void;
}) {
  const spec = bookSpec(chapterCount);
  const capped = maxChapters < MAX_CHAPTERS;
  const photosForNextChapter = (maxChapters + 1) * MIN_PHOTOS_PER_CHAPTER;

  return (
    <section className="animate-fade-up space-y-6">
      <div className="rounded-2xl border border-line bg-white p-6 shadow-lift sm:p-8">
        <h2 className="font-display text-2xl text-ink">Choose your book size</h2>
        <p className="mt-2 text-sm text-ink-soft">
          More photos never cost more. Chapters do — each one adds 10 story pages
          for $10.
        </p>

        <div className="mt-7">
          <label
            htmlFor="chapterCount"
            className="flex items-baseline justify-between"
          >
            <span className="text-sm font-medium text-ink-soft">Chapters</span>
            <span className="font-display text-3xl text-ink">{chapterCount}</span>
          </label>

          <input
            id="chapterCount"
            type="range"
            min={BASE_CHAPTERS}
            max={maxChapters}
            step={1}
            value={chapterCount}
            onChange={(event) => onChange(Number(event.target.value))}
            className="mt-3 w-full accent-periwinkle"
            aria-describedby="chapterCountHelp"
          />

          <ol className="mt-3 flex flex-wrap gap-1.5" aria-hidden>
            {Array.from(
              { length: MAX_CHAPTERS - BASE_CHAPTERS + 1 },
              (_, index) => BASE_CHAPTERS + index,
            ).map((count) => {
              const supported = count <= maxChapters;
              return (
                <li key={count}>
                  <button
                    type="button"
                    disabled={!supported}
                    onClick={() => onChange(count)}
                    title={
                      supported
                        ? `${count} chapters`
                        : `Needs about ${count * MIN_PHOTOS_PER_CHAPTER} usable photos`
                    }
                    className={`h-8 w-8 rounded-md border text-xs transition-colors ${
                      count === chapterCount
                        ? "border-periwinkle bg-periwinkle text-white"
                        : supported
                          ? "border-line bg-white text-ink-soft hover:border-periwinkle"
                          : "cursor-not-allowed border-dashed border-line bg-memory-blue/50 text-ink-faint/60"
                    }`}
                  >
                    {count}
                  </button>
                </li>
              );
            })}
          </ol>

          <p id="chapterCountHelp" className="mt-3 text-sm text-ink-soft">
            {capped ? (
              <>
                Your {placeablePhotos.toLocaleString()} usable photos comfortably
                fill <strong>{maxChapters} chapters</strong>. Longer books are
                greyed out because we won&rsquo;t pad a chapter with repeats —
                about {photosForNextChapter.toLocaleString()} photos would unlock
                the next one.
              </>
            ) : (
              <>
                Your album can fill any size we offer, up to {MAX_CHAPTERS}{" "}
                chapters.
              </>
            )}
          </p>
        </div>

        <dl className="mt-7 grid grid-cols-2 gap-4 border-t border-line pt-6 sm:grid-cols-4">
          <Stat label="Story pages" value={`${spec.storyPages}`} />
          <Stat
            label="Complimentary pages"
            value={`${FIXED_INTERIOR_PAGES}`}
            hint="Title, dedication, closing, imprint"
          />
          <Stat
            label="Photos we'll place"
            value={photosPlacedLabel(spec.estimatedPhotos, placeablePhotos)}
          />
          <Stat label="Your price" value={formatUsd(spec.price)} emphasis />
        </dl>

        <p className="mt-4 text-xs text-ink-faint">
          Printed as a {spec.totalInteriorPages}-page interior in an 8.5 × 8.5 in
          hardcover. Shipping and tax are calculated at checkout.
        </p>

        <div className="mt-7 flex flex-wrap items-center gap-4">
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-xl bg-periwinkle px-7 py-3 text-base font-semibold text-white shadow-lift transition-colors hover:bg-periwinkle-deep"
          >
            Confirm book size
          </button>
          <button
            type="button"
            onClick={onBack}
            className="text-sm text-ink-soft underline decoration-line underline-offset-4 transition-colors hover:text-periwinkle-deep"
          >
            Back
          </button>
        </div>
      </div>
    </section>
  );
}

/**
 * The target range, capped by what the album actually holds. When the cap bites
 * on both ends, every usable photo is placed, so show one number.
 */
function photosPlacedLabel(
  estimate: { min: number; max: number },
  placeable: number,
): string {
  const low = Math.min(estimate.min, placeable);
  const high = Math.min(estimate.max, placeable);
  return low === high ? `${low}` : `${low}–${high}`;
}

function Stat({
  label,
  value,
  hint,
  emphasis,
}: {
  label: string;
  value: string;
  hint?: string;
  emphasis?: boolean;
}) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-ink-faint">{label}</dt>
      <dd
        className={`mt-1 font-display text-xl ${emphasis ? "text-periwinkle-deep" : "text-ink"}`}
      >
        {value}
      </dd>
      {hint && <p className="mt-0.5 text-xs text-ink-faint">{hint}</p>}
    </div>
  );
}
