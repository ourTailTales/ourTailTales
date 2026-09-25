"use client";

import { ChevronLeft, ChevronRight, Download, Lock, Maximize2, RotateCcw } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { track } from "@/lib/analytics";

import { CoverCanvas, PageCanvas } from "@/components/book-viewer/PageCanvas";
import { ExpiryBanner } from "@/components/ExpiryBanner";
import { PageZoom } from "@/components/book-viewer/PageZoom";
import { DesignPicker } from "@/components/studio/DesignPicker";
import { LockedWall } from "@/components/studio/LockedWall";
import { PageFilmstrip } from "@/components/studio/PageFilmstrip";
import { PageInspector } from "@/components/studio/PageInspector";
import { TEASER_DESIGN_ID, withDesign } from "@/lib/book/design";
import { buildSlides } from "@/lib/book/studio";
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
  const bookMeta = useOurTailTalesStore((state) => state.meta);
  // Signed out, the book is shown exactly as the free PDF prints it: in the
  // scrapbook. Choosing another design is part of what an account unlocks.
  const meta = useMemo(
    () => (unlocked ? bookMeta : withDesign(bookMeta, TEASER_DESIGN_ID)),
    [bookMeta, unlocked],
  );
  const chapters = useOurTailTalesStore((state) => state.chapters);
  const pages = useOurTailTalesStore((state) => state.pages);
  const photos = useOurTailTalesStore((state) => state.photos);
  const originalBook = useOurTailTalesStore((state) => state.originalBook);
  const resetToOriginal = useOurTailTalesStore((state) => state.resetToOriginal);
  const bookExpiresAt = useOurTailTalesStore((state) => state.bookExpiresAt);

  const [selected, setSelected] = useState(0);
  const [confirmReset, setConfirmReset] = useState(false);
  const [zoomed, setZoomed] = useState(false);

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

  // Only where "Continue to Edit" ever meant anything: a free page, read by
  // someone with no account yet. A locked page already makes its own case in
  // LockedWall, and an unlocked account has nothing left to continue to.
  const showContinueToEdit = !slide.locked && !unlocked;

  return (
    <div className="flex flex-col gap-5">
      {!unlocked && bookExpiresAt ? (
        <ExpiryBanner
          expiresAt={bookExpiresAt}
          petName={meta.petName}
          action={
            <button
              type="button"
              onClick={onUnlock}
              className="inline-flex min-h-11 items-center justify-center rounded-xl bg-periwinkle px-6 text-sm font-semibold text-white shadow-lift transition-colors hover:bg-periwinkle-deep"
            >
              Create my free account
            </button>
          }
        />
      ) : null}

      {notice ? (
        <p
          role="alert"
          className="rounded-xl border border-periwinkle/30 bg-periwinkle-wash/40 px-4 py-3 text-sm text-periwinkle-deep"
        >
          {notice}
        </p>
      ) : null}

      <div className="flex flex-col gap-5">
        {/* Viewport — one page at a time, at every width. The carousel's
            peek-at-the-neighbors treatment did not render the page correctly
            once it was squeezed to a partial-width slide on a phone, so this
            goes back to the same full-width page and chevrons on mobile as
            on desktop. */}
        <div className="relative">
          <div className="relative mx-auto w-full max-w-[min(100%,calc(100dvh-9rem))]">
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
                // A label, not a control — the actual way through is the
                // account CTA below (LockedWall or, here, the sidebar),
                // never two competing buttons on the same locked page.
                <div className="absolute inset-0 flex items-center justify-center bg-white/45 p-5">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-white/90 px-4 py-2 text-sm font-semibold text-page-ink-soft shadow-sm">
                    <Lock aria-hidden className="size-3.5" />
                    Sign up to view this page
                  </span>
                </div>
              ) : (
                // Set body text on a page this size reads around six pixels
                // on a phone. This is the way to actually read it.
                <button
                  type="button"
                  onClick={() => setZoomed(true)}
                  aria-label={`Read ${slide.label} full size`}
                  className="absolute bottom-2.5 right-2.5 flex size-9 items-center justify-center rounded-full bg-white/90 text-page-ink-soft shadow-sm backdrop-blur transition-colors hover:text-periwinkle-deep"
                >
                  <Maximize2 aria-hidden className="size-4" strokeWidth={2.25} />
                </button>
              )}
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

          {zoomed ? (
            <PageZoom
              page={slide.page}
              label={slide.label}
              meta={meta}
              chapters={chapters}
              photos={photoMap}
              photoList={photoList}
              onClose={() => setZoomed(false)}
            />
          ) : null}

          {/* Floating on the seam between the page and the carousel below it
              — the moment someone has just been reading is the moment this
              is most worth catching their eye, not a panel further down the
              page they may never scroll to. */}
          {showContinueToEdit ? (
            <button
              type="button"
              onClick={onUnlock}
              className="absolute bottom-0 left-1/2 z-20 inline-flex -translate-x-1/2 translate-y-1/2 items-center justify-center whitespace-nowrap rounded-full bg-periwinkle px-6 py-3 text-sm font-semibold text-white shadow-lift transition-colors hover:bg-periwinkle-deep sm:px-8 sm:text-base"
            >
              Signup to Edit
            </button>
          ) : null}
        </div>

        {/* Filmstrip — under the page on every width, so switching pages and
            looking at one stay next to each other. */}
        <div className="-mx-5 overflow-hidden sm:-mx-8 lg:mx-0 lg:rounded-xl lg:border lg:border-page-line">
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

        {/* Tools for this page, or the way past the wall. Below the carousel
            at every width now, rather than in a column beside it: the page is
            what people came to look at, so it gets the whole width, and the
            account CTA is what they read next, so it comes next. */}
        <aside className="mx-auto w-full max-w-2xl">
          {slide.locked ? (
            <LockedWall
              petName={meta.petName}
              hiddenPages={teaser.hiddenPages}
              hiddenChapters={teaser.hiddenChapters}
              onUnlock={onUnlock}
            />
          ) : unlocked ? (
            <div className="flex flex-col gap-4">
            <div className="rounded-2xl border border-page-line bg-white/95 p-5">
              <DesignPicker
                page={slide.page}
                meta={meta}
                chapters={chapters}
                photos={photoMap}
              />
            </div>
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
            </div>
          ) : null}
        </aside>

        {/* Download, below the tools on narrow screens. No free-pages
            download here either: signed out, there is only the order. */}
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-2.5 lg:hidden">
          {unlocked ? (
            <button
              type="button"
              onClick={onDownload}
              disabled={downloading}
              className="inline-flex min-h-11 w-full items-center justify-center gap-1.5 rounded-xl border border-page-line bg-white px-4 text-sm font-medium text-page-ink-soft transition-colors hover:border-periwinkle hover:text-periwinkle-deep disabled:opacity-60"
            >
              <Download aria-hidden className="size-3.5" />
              {downloading ? "Preparing…" : "Download PDF"}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}