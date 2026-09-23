"use client";

import { ChevronLeft, ChevronRight, Download, RotateCcw } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { track } from "@/lib/analytics";

import { CoverCanvas, PageCanvas } from "@/components/book-viewer/PageCanvas";
import { LockedWall } from "@/components/studio/LockedWall";
import { PageFilmstrip } from "@/components/studio/PageFilmstrip";
import { PageInspector } from "@/components/studio/PageInspector";
import { buildSlides, lockWallIndex } from "@/lib/book/studio";
import { summarizeTeaser } from "@/lib/book/teaser";
import { selectablePhotos } from "@/lib/photo/dedupe";
import { formatUsd } from "@/lib/pricing";
import { photoMapOf, useOurTailTalesStore } from "@/store/useOurTailTalesStore";

/**
 * The book, page by page, with the tools for whichever page is open.
 *
 * One component serves both the signed-out reader and the signed-in editor.
 * They are the same flip-through; `unlocked` decides whether the pages past
 * the teaser are readable and whether the side panel offers tools or an
 * account. Keeping them as one thing is what stops the preview and the editor
 * from slowly becoming two different books.
 */
export function BookStudio({
  unlocked,
  price,
  onUnlock,
  onRegenerate,
  onFiles,
  processing,
  onDownload,
  onCheckout,
  downloading,
  notice,
}: {
  unlocked: boolean;
  price: number;
  onUnlock: () => void;
  onRegenerate: (chapterId: string) => void;
  onFiles: (files: File[]) => void;
  processing: boolean;
  onDownload: () => void;
  onCheckout: () => void;
  downloading: boolean;
  notice?: string | null;
}) {
  const meta = useOurTailTalesStore((state) => state.meta);
  const chapters = useOurTailTalesStore((state) => state.chapters);
  const pages = useOurTailTalesStore((state) => state.pages);
  const photos = useOurTailTalesStore((state) => state.photos);
  const originalBook = useOurTailTalesStore((state) => state.originalBook);
  const resetToOriginal = useOurTailTalesStore((state) => state.resetToOriginal);

  const [selected, setSelected] = useState(0);
  const [confirmReset, setConfirmReset] = useState(false);

  const photoMap = useMemo(() => photoMapOf(photos), [photos]);
  const photoList = useMemo(() => selectablePhotos(photos), [photos]);
  const slides = useMemo(
    () => buildSlides(pages, chapters, { unlocked }),
    [pages, chapters, unlocked],
  );
  const teaser = useMemo(
    () => summarizeTeaser(pages, chapters),
    [pages, chapters],
  );

  // A book that shrinks under the cursor (chapters removed, photos pulled)
  // must never leave the viewport pointing at a page that no longer exists.
  const position = Math.min(selected, Math.max(0, slides.length - 1));
  const slide = slides[position];

  const move = useCallback(
    (delta: number) => {
      setSelected((current) =>
        Math.min(Math.max(current + delta, 0), slides.length - 1),
      );
    },
    [slides.length],
  );

  // The moment someone runs out of free book is the number worth watching.
  const wallSeen = useRef(false);
  useEffect(() => {
    if (unlocked || wallSeen.current) return;
    if (!slides[position]?.locked) return;
    wallSeen.current = true;
    track("teaser_wall_reached", { pages: slides.length });
  }, [position, slides, unlocked]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      const target = event.target as HTMLElement | null;
      // Arrow keys belong to whatever the customer is typing in.
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
      if (event.key === "ArrowLeft") move(-1);
      if (event.key === "ArrowRight") move(1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [move]);

  if (!slide) return null;

  const wall = lockWallIndex(slides);
  const readableCount = wall === null ? slides.length : wall;

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="truncate font-display text-xl text-page-ink sm:text-2xl">
            {meta.petName.trim() || "Your book"}
          </h1>
          <p className="mt-0.5 text-xs text-page-ink-faint">
            {slide.label} · page {position + 1} of {slides.length}
            {unlocked ? "" : ` · ${readableCount} readable for now`}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {unlocked && originalBook ? (
            confirmReset ? (
              <span className="flex items-center gap-2 text-xs text-page-ink-soft">
                Undo every change?
                <button
                  type="button"
                  onClick={() => {
                    resetToOriginal();
                    setConfirmReset(false);
                  }}
                  className="rounded-lg border border-page-line bg-white px-2.5 py-1.5 font-semibold text-page-ink hover:border-periwinkle"
                >
                  Yes, reset
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmReset(false)}
                  className="underline underline-offset-4 hover:text-periwinkle-deep"
                >
                  Cancel
                </button>
              </span>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmReset(true)}
                className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-page-line bg-white px-3 text-xs font-medium text-page-ink-soft transition-colors hover:border-periwinkle hover:text-periwinkle-deep"
              >
                <RotateCcw aria-hidden className="size-3.5" />
                Reset to original
              </button>
            )
          ) : null}

          <button
            type="button"
            onClick={onDownload}
            disabled={downloading}
            className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-page-line bg-white px-3 text-xs font-medium text-page-ink-soft transition-colors hover:border-periwinkle hover:text-periwinkle-deep disabled:opacity-60"
          >
            <Download aria-hidden className="size-3.5" />
            {downloading ? "Preparing…" : unlocked ? "Download PDF" : "Download free pages"}
          </button>

          <button
            type="button"
            onClick={onCheckout}
            className="inline-flex min-h-10 items-center rounded-lg bg-periwinkle px-4 text-sm font-semibold text-white shadow-lift transition-colors hover:bg-periwinkle-deep"
          >
            Order hardcover · {formatUsd(price)}
          </button>
        </div>
      </header>

      {notice ? (
        <p
          role="alert"
          className="rounded-xl border border-periwinkle/30 bg-periwinkle-wash/40 px-4 py-3 text-sm text-periwinkle-deep"
        >
          {notice}
        </p>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_23rem] lg:items-start">
        {/* Viewport */}
        <div className="lg:col-start-1 lg:row-start-1">
          <div className="relative mx-auto w-full max-w-[34rem]">
            <div className="overflow-hidden rounded-xl bg-white shadow-[0_18px_50px_-24px_rgb(25_32_58/0.5)] ring-1 ring-page-line">
              <div className={slide.locked ? "blur-[7px] saturate-50" : ""}>
                {slide.page ? (
                  <PageCanvas
                    page={slide.page}
                    meta={meta}
                    chapters={chapters}
                    photos={photoMap}
                    placeholder={slide.locked}
                  />
                ) : (
                  <CoverCanvas meta={meta} photos={photoList} />
                )}
              </div>

              {slide.locked ? (
                <div className="absolute inset-0 flex items-center justify-center bg-white/45 p-5">
                  <button
                    type="button"
                    onClick={onUnlock}
                    className="rounded-xl bg-periwinkle px-5 py-3 text-sm font-semibold text-white shadow-lift hover:bg-periwinkle-deep"
                  >
                    Unlock this page
                  </button>
                </div>
              ) : null}
            </div>

            <button
              type="button"
              aria-label="Previous page"
              onClick={() => move(-1)}
              disabled={position === 0}
              className="absolute -left-2 top-1/2 flex size-10 -translate-y-1/2 items-center justify-center rounded-full border border-page-line bg-white/95 text-page-ink shadow-sm transition-colors hover:border-periwinkle disabled:opacity-0 sm:-left-5"
            >
              <ChevronLeft aria-hidden className="size-5" />
            </button>
            <button
              type="button"
              aria-label="Next page"
              onClick={() => move(1)}
              disabled={position >= slides.length - 1}
              className="absolute -right-2 top-1/2 flex size-10 -translate-y-1/2 items-center justify-center rounded-full border border-page-line bg-white/95 text-page-ink shadow-sm transition-colors hover:border-periwinkle disabled:opacity-0 sm:-right-5"
            >
              <ChevronRight aria-hidden className="size-5" />
            </button>
          </div>
        </div>

        {/* Filmstrip — under the page on every width, so switching pages and
            looking at one stay next to each other. */}
        <div className="-mx-5 overflow-hidden sm:-mx-8 lg:col-start-1 lg:row-start-2 lg:mx-0 lg:rounded-xl lg:border lg:border-page-line">
          <PageFilmstrip
            slides={slides}
            selected={position}
            onSelect={setSelected}
            meta={meta}
            chapters={chapters}
            photos={photoMap}
            photoList={photoList}
          />
        </div>

        {/* Tools for this page, or the way past the wall. */}
        <aside className="lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:sticky lg:top-6">
          {slide.locked ? (
            <LockedWall
              petName={meta.petName}
              hiddenPages={teaser.hiddenPages}
              hiddenChapters={teaser.hiddenChapters}
              onUnlock={onUnlock}
            />
          ) : unlocked ? (
            <div className="rounded-2xl border border-page-line bg-white/95 p-5">
              <PageInspector
                key={slide.key}
                slide={slide}
                photos={photoList}
                onRegenerate={onRegenerate}
                onFiles={onFiles}
                processing={processing}
              />
            </div>
          ) : (
            <ReadOnlyAside onUnlock={onUnlock} />
          )}
        </aside>
      </div>
    </div>
  );
}

/**
 * What the side panel says before there is an account.
 *
 * Reading comes first and editing comes after, so this is not a disabled
 * toolbar — it is a short, honest list of what the account turns on. Naming
 * the tools now is what makes the book feel like theirs to change rather than
 * a file they were handed.
 */
function ReadOnlyAside({ onUnlock }: { onUnlock: () => void }) {
  return (
    <div className="rounded-2xl border border-page-line bg-white/95 p-5">
      <h2 className="font-display text-lg text-page-ink">This is your book</h2>
      <p className="mt-1.5 text-sm leading-6 text-page-ink-soft">
        We wrote every chapter from your own photos. Nothing here is fixed —
        once it is saved to your account you can change:
      </p>
      <ul className="mt-3 space-y-1.5 text-sm text-page-ink-soft">
        {[
          "The cover — photo, style, lettering",
          "Every chapter's title and story",
          "Which photo opens each chapter",
          "Any photo on any page",
          "The dedication",
        ].map((item) => (
          <li key={item} className="flex gap-2">
            <span aria-hidden className="mt-2 size-1 shrink-0 rounded-full bg-periwinkle" />
            {item}
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={onUnlock}
        className="mt-5 inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-periwinkle px-5 text-sm font-semibold text-white shadow-lift transition-colors hover:bg-periwinkle-deep"
      >
        Save it and start editing
      </button>
      <p className="mt-2.5 text-center text-xs text-page-ink-faint">
        Free — you already gave us your email.
      </p>
    </div>
  );
}
