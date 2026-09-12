"use client";

import type { BookMeta } from "@/types/book";
import {
  BASE_CHAPTERS,
  MAX_CHAPTERS,
  STORY_PAGES_PER_CHAPTER,
  luluInteriorPages,
  storyPages,
} from "@/lib/pricing";
import type { AlbumSummary } from "@/store/useOurTailTalesStore";

const inputClass =
  "w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink outline-none transition-colors placeholder:text-ink-faint focus:border-periwinkle focus:ring-2 focus:ring-periwinkle/20";

export function FoundPage({ summary }: { summary: AlbumSummary }) {
  return (
    <div className="flex h-full flex-col justify-center overflow-y-auto">
      <h2 className="font-display text-xl leading-snug text-ink sm:text-2xl">
        Here&rsquo;s what we found
      </h2>

      <dl className="mt-4 grid grid-cols-2 gap-3">
        <Stat label="Photos read" value={summary.total.toLocaleString()} />
        <Stat label="Ready to place" value={summary.placeable.toLocaleString()} />
        <Stat
          label="Years covered"
          value={formatRange(summary.firstAt, summary.lastAt)}
        />
        <Stat
          label="With location"
          value={
            summary.withGps > 0 ? summary.withGps.toLocaleString() : "None"
          }
        />
      </dl>

      <ul className="mt-4 space-y-1.5 text-xs leading-5 text-ink-soft">
        {summary.duplicates > 0 && (
          <li>
            {summary.duplicates.toLocaleString()} near-duplicate
            {summary.duplicates === 1 ? "" : "s"} set aside — best versions kept.
          </li>
        )}
        {summary.weak > 0 && (
          <li>
            {summary.weak.toLocaleString()} too small or dark to print well.
          </li>
        )}
        {summary.approximateDates && (
          <li>Some dates are approximate.</li>
        )}
        {summary.withGps === 0 && (
          <li>No location data — chapters from dates alone.</li>
        )}
      </ul>
    </div>
  );
}

export function MetaPage({
  summary,
  meta,
  onMetaChange,
  onContinue,
  onStartOver,
}: {
  summary: AlbumSummary;
  meta: BookMeta;
  onMetaChange: (patch: Partial<BookMeta>) => void;
  onContinue: () => void;
  onStartOver: () => void;
}) {
  const canContinue = meta.petName.trim().length > 0 && summary.placeable > 0;

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <h2 className="font-display text-xl leading-snug text-ink sm:text-2xl">
        Tell us about them
      </h2>
      <p className="mt-1 text-xs text-ink-soft">
        Only what the album can&rsquo;t tell us on its own.
      </p>

      <div className="mt-3 space-y-3">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-ink-soft">
            Pet&rsquo;s name <span className="text-periwinkle">*</span>
          </span>
          <input
            value={meta.petName}
            onChange={(event) => onMetaChange({ petName: event.target.value })}
            placeholder="Biscuit"
            autoComplete="off"
            className={inputClass}
          />
        </label>

        <div className="grid grid-cols-2 gap-2">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-ink-soft">
              Birth year
            </span>
            <input
              value={meta.birthYear}
              onChange={(event) =>
                onMetaChange({ birthYear: digitsOnly(event.target.value) })
              }
              placeholder="2012"
              inputMode="numeric"
              maxLength={4}
              className={inputClass}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-ink-soft">
              Final year
            </span>
            <input
              value={meta.deathYear}
              onChange={(event) =>
                onMetaChange({ deathYear: digitsOnly(event.target.value) })
              }
              placeholder="2024"
              inputMode="numeric"
              maxLength={4}
              className={inputClass}
            />
          </label>
        </div>

        <label className="block">
          <span className="mb-1 block text-xs font-medium text-ink-soft">
            Dedication (optional)
          </span>
          <textarea
            value={meta.dedication}
            onChange={(event) =>
              onMetaChange({ dedication: event.target.value.slice(0, 320) })
            }
            rows={2}
            placeholder="For the best copilot a family could ask for."
            className={`${inputClass} resize-none`}
          />
        </label>
      </div>

      <div className="mt-auto flex flex-wrap items-center gap-3 pt-4">
        <button
          type="button"
          onClick={onContinue}
          disabled={!canContinue}
          className="rounded-xl bg-periwinkle px-5 py-2.5 text-sm font-semibold text-white shadow-lift transition-colors hover:bg-periwinkle-deep disabled:cursor-not-allowed disabled:opacity-50"
        >
          Continue
        </button>
        <button
          type="button"
          onClick={onStartOver}
          className="text-xs text-ink-soft underline decoration-line underline-offset-4 hover:text-periwinkle-deep"
        >
          Different album
        </button>
      </div>
    </div>
  );
}

export function SizePages({
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
  const capped = maxChapters < MAX_CHAPTERS;
  const toc = buildTableOfContents(chapterCount);
  const canRemove = chapterCount > BASE_CHAPTERS;
  const canAdd = chapterCount < maxChapters;

  return {
    left: (
      <div className="flex h-full flex-col overflow-y-auto">
        <h2 className="font-display text-xl leading-snug text-ink sm:text-2xl">
          Contents
        </h2>
        <p className="mt-1 text-xs text-ink-soft">
          How their story will read, page by page.
        </p>

        <ol className="mt-4 flex-1 space-y-0 font-cover text-[13px] leading-6 text-ink sm:text-sm">
          {toc.map((entry) => (
            <li
              key={entry.id}
              className={`flex items-baseline gap-2 ${
                entry.kind === "chapter" ? "text-ink" : "text-ink-soft"
              }`}
            >
              <span
                className={`min-w-0 shrink truncate ${
                  entry.kind === "chapter" ? "font-semibold" : ""
                }`}
              >
                {entry.label}
              </span>
              <span
                aria-hidden
                className="mb-1 min-w-[1.5rem] flex-1 border-b border-dotted border-ink/25"
              />
              <span className="shrink-0 tabular-nums text-ink-faint">
                {entry.pages}
              </span>
            </li>
          ))}
        </ol>
      </div>
    ),
    right: (
      <div className="flex h-full flex-col overflow-y-auto">
        <h2 className="font-display text-xl leading-snug text-ink sm:text-2xl">
          Shape the chapters
        </h2>
        <p className="mt-1 text-xs leading-5 text-ink-soft">
          Each chapter adds {STORY_PAGES_PER_CHAPTER} story pages. Add or remove
          chapters to fit how much of their life you want to keep.
        </p>

        <div className="mt-5 flex items-center justify-center gap-4">
          <button
            type="button"
            aria-label="Remove a chapter"
            disabled={!canRemove}
            onClick={() => onChange(chapterCount - 1)}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-line text-lg text-ink transition-colors hover:border-periwinkle hover:text-periwinkle-deep disabled:cursor-not-allowed disabled:opacity-35"
          >
            &minus;
          </button>
          <div className="min-w-[7rem] text-center">
            <p className="font-display text-3xl tabular-nums text-ink">
              {chapterCount}
            </p>
            <p className="text-[11px] font-medium uppercase tracking-wide text-ink-faint">
              {chapterCount === 1 ? "chapter" : "chapters"}
            </p>
          </div>
          <button
            type="button"
            aria-label="Add a chapter"
            disabled={!canAdd}
            onClick={() => onChange(chapterCount + 1)}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-line text-lg text-ink transition-colors hover:border-periwinkle hover:text-periwinkle-deep disabled:cursor-not-allowed disabled:opacity-35"
          >
            +
          </button>
        </div>

        <p className="mt-4 text-center text-xs leading-5 text-ink-soft">
          {storyPages(chapterCount)} story pages
          <span className="text-ink-faint"> · </span>
          {luluInteriorPages(chapterCount)} pages in all
        </p>

        <p className="mt-3 text-xs leading-5 text-ink-soft">
          {capped ? (
            <>
              Your {placeablePhotos.toLocaleString()} usable photos fill{" "}
              <strong className="font-medium text-ink">{maxChapters} chapters</strong>{" "}
              comfortably.
            </>
          ) : (
            <>Your album can fill up to {MAX_CHAPTERS} chapters.</>
          )}
        </p>

        <div className="mt-auto flex flex-wrap items-center gap-3 pt-4">
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-xl bg-periwinkle px-5 py-2.5 text-sm font-semibold text-white shadow-lift transition-colors hover:bg-periwinkle-deep"
          >
            Continue with these chapters
          </button>
          <button
            type="button"
            onClick={onBack}
            className="text-xs text-ink-soft underline decoration-line underline-offset-4 hover:text-periwinkle-deep"
          >
            Back
          </button>
        </div>
      </div>
    ),
  };
}

type TocEntry = {
  id: string;
  label: string;
  pages: string;
  kind: "front" | "chapter" | "back";
};

/** Mirrors `paginateBook`: title, dedication, 10 pages/chapter, closing, imprint. */
function buildTableOfContents(chapterCount: number): TocEntry[] {
  const entries: TocEntry[] = [
    { id: "title", label: "Title", pages: "1", kind: "front" },
    { id: "dedication", label: "Dedication", pages: "2", kind: "front" },
  ];

  for (let index = 0; index < chapterCount; index += 1) {
    const start = 3 + index * STORY_PAGES_PER_CHAPTER;
    const end = start + STORY_PAGES_PER_CHAPTER - 1;
    entries.push({
      id: `chapter-${index + 1}`,
      label: `Chapter ${index + 1}`,
      pages: `${start}–${end}`,
      kind: "chapter",
    });
  }

  const closing = 2 + chapterCount * STORY_PAGES_PER_CHAPTER + 1;
  entries.push(
    { id: "closing", label: "Closing", pages: `${closing}`, kind: "back" },
    { id: "imprint", label: "Imprint", pages: `${closing + 1}`, kind: "back" },
  );

  return entries;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-wide text-ink-faint">{label}</dt>
      <dd className="mt-0.5 font-display text-lg text-ink">{value}</dd>
    </div>
  );
}

function formatRange(firstAt: number | null, lastAt: number | null): string {
  if (firstAt === null) return "Unknown";
  const start = new Date(firstAt).getFullYear();
  const end = lastAt !== null ? new Date(lastAt).getFullYear() : start;
  return start === end ? `${start}` : `${start}–${end}`;
}

function digitsOnly(value: string): string {
  return value.replace(/\D/g, "").slice(0, 4);
}
