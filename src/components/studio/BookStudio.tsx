"use client";

import {
  BookImage,
  ChevronLeft,
  ChevronRight,
  Download,
  Lock,
  Maximize2,
  Palette,
  RotateCcw,
  SlidersHorizontal,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { track } from "@/lib/analytics";

import { CoverCanvas, PageCanvas } from "@/components/book-viewer/PageCanvas";
import { ExpiryBanner } from "@/components/ExpiryBanner";
import { PageZoom } from "@/components/book-viewer/PageZoom";
import { CoverStylePicker } from "@/components/studio/CoverStylePicker";
import { DesignPicker } from "@/components/studio/DesignPicker";
import { LockedWall } from "@/components/studio/LockedWall";
import { PageFilmstrip } from "@/components/studio/PageFilmstrip";
import { PageInspector } from "@/components/studio/PageInspector";
import { ToolsDock, type ToolSection } from "@/components/studio/ToolsDock";
import { TEASER_DESIGN_ID, withDesign } from "@/lib/book/design";
import { buildSlides } from "@/lib/book/studio";
import { summarizeTeaser } from "@/lib/book/teaser";
import { selectablePhotos } from "@/lib/photo/dedupe";
import { formatUsd } from "@/lib/pricing";
import { photoMapOf, useOurTailTalesStore } from "@/store/useOurTailTalesStore";

/**
 * How many pages either side of the one in the window are really drawn.
 *
 * The carousel holds every page of the book so that a swipe has somewhere to
 * go and the row's arithmetic stays the page's index; a fifty-chapter book is
 * over five hundred of them, and drawing every one with its photographs to
 * show one page would decode a couple of thousand images. Everything further
 * out than this holds its place with an empty square of the same size and
 * fills in as the customer moves.
 */
const CANVAS_WINDOW = 2;

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
  /** How far the page has been dragged sideways, in pixels. */
  const [drag, setDrag] = useState(0);

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

  /**
   * Turning the page by pushing it.
   *
   * The same gesture the strip below already answers to, on the thing people
   * actually look at: drag or swipe the book sideways and it follows your
   * hand — the page you are leaving going out one side, the next one coming
   * in the other — and letting go past a quarter of a page turns it. Anything
   * short of that springs back, so a hesitant swipe never loses your place.
   * Vertical movement is left alone — the page still scrolls under a thumb.
   */
  const swipe = useRef<{ x: number; y: number; active: boolean } | null>(null);
  /** True from the end of a drag until the click it would otherwise fire. */
  const justSwiped = useRef(false);
  const SWIPE_SLOP = 8;

  const onPagePointerDown = (event: React.PointerEvent<HTMLDivElement>): void => {
    if (event.button !== 0 || zoomed) return;
    swipe.current = { x: event.clientX, y: event.clientY, active: false };
  };

  const onPagePointerMove = (event: React.PointerEvent<HTMLDivElement>): void => {
    const start = swipe.current;
    if (!start) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    // A gesture is a page turn only once it is clearly sideways; until then
    // it may still be a scroll, and the page must not swallow it.
    if (!start.active) {
      if (Math.abs(dx) < SWIPE_SLOP || Math.abs(dx) <= Math.abs(dy)) return;
      start.active = true;
      event.currentTarget.setPointerCapture(event.pointerId);
    }
    // Resistance at the ends: the first and last pages give a little and
    // stop, the way a real book does.
    const atEnd = (dx > 0 && position === 0) || (dx < 0 && position >= slides.length - 1);
    setDrag(atEnd ? dx * 0.25 : dx);
  };

  const endPageSwipe = (event: React.PointerEvent<HTMLDivElement>): void => {
    const start = swipe.current;
    swipe.current = null;
    if (start?.active && event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (!start?.active) return;
    // The click this pointer is about to fire belongs to the drag, not to
    // whatever it happened to finish on top of.
    justSwiped.current = true;
    const width = event.currentTarget.clientWidth || 1;
    if (Math.abs(drag) > Math.min(width * 0.25, 120)) move(drag < 0 ? 1 : -1);
    setDrag(0);
  };

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

  // One definition of each tool panel, shown in the sidebar on a wide screen
  // and lifted into a sheet from the dock on a narrow one.
  const designPanel = (): ReactNode => (
    <DesignPicker page={slide.page} meta={meta} chapters={chapters} photos={photoMap} />
  );
  const pagePanel = (): ReactNode => (
    <PageInspector
      key={slide.key}
      slide={slide}
      photos={photoList}
      onRegenerate={onRegenerate}
      onFiles={onFiles}
      processing={processing}
      unlocked={unlocked}
      onUnlock={onUnlock}
    />
  );
  const coverPanel = (): ReactNode => (
    <div>
      <h2 className="font-display text-lg text-page-ink">Cover styles</h2>
      <p className="mt-1 text-xs leading-5 text-page-ink-faint">
        Your free book is bound in the first one. The rest — including two with no photo at
        all — open with an account.
      </p>
      <div className="mt-3">
        <CoverStylePicker
          current={meta.coverLayoutId}
          petName={meta.petName}
          unlocked={false}
          onPick={() => {}}
          onUnlock={onUnlock}
        />
      </div>
    </div>
  );

  // What the tools are, for this page and this reader. A locked page has no
  // tools at all — what it has is the wall, which is not a tool but the
  // whole point of the page, and stays under the book where it is read.
  const pageSection: ToolSection | null = slide.locked
    ? null
    : unlocked
      ? {
          id: `page-${slide.key}`,
          label: slide.page ? slide.label : "Cover",
          icon: <SlidersHorizontal aria-hidden className="size-5" />,
          panel: pagePanel,
        }
      : slide.page
        ? null
        : {
            id: "covers",
            label: "Cover styles",
            icon: <BookImage aria-hidden className="size-5" />,
            panel: coverPanel,
          };

  // The book design sits under the carousel on a wide screen, where it
  // belongs to the whole book rather than to this page; on a phone, where
  // there is no room under anything, it stays in the dock.
  const showDesignBelow = unlocked && !slide.locked;
  const dockSections: ToolSection[] = [
    ...(pageSection ? [pageSection] : []),
    ...(showDesignBelow
      ? [
          {
            id: "design",
            label: "Book design",
            icon: <Palette aria-hidden className="size-5" />,
            panel: designPanel,
          },
        ]
      : []),
  ];

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

      {/* The book and its tools, side by side where there is room for both.
          The tools used to sit under the page and under the filmstrip, so
          changing anything began with scrolling the book off the screen. */}
      <div
        className={
          pageSection
            ? // One gap for the whole editor: the same space between the page
              // and the strip as between the book and its tools.
              //
              // The book's column is the width of the book — the same cap the
              // page itself takes, so the column cannot be wider than what it
              // holds — and the pair is centred together. Sized to what was
              // left over instead, the column centred the page inside itself,
              // which put ninety pixels between the tools and the book and
              // sixteen everywhere else.
              // `items-stretch` is what keeps the tools flush with the book:
              // the first row is as tall as the page and the carousel, and
              // the tools' cell is stretched to it whatever the panel holds.
              "lg:grid lg:grid-cols-[21rem_minmax(0,calc(100dvh-9rem))] lg:items-stretch lg:justify-center lg:gap-4"
            : ""
        }
      >
        {/*
         * The tools, flush with the book beside them: the top of the page to
         * the foot of the carousel, exactly, at whatever height the book
         * takes.
         *
         * The panel inside is taken out of the flow — absolute inside a
         * stretched grid cell — so its own height can never set the height of
         * the row. It used to: the cover's panel is twice the height of a
         * photo page's, so turning a page resized the whole layout and the
         * book jumped under the reader while they were moving sideways
         * through it. Now the book decides the height — the page and the
         * carousel, the only things sharing this row — and the tools fit
         * themselves into it, scrolling inside if there is more of them.
         */}
        <aside className="relative hidden select-none lg:block [&_input]:select-text [&_textarea]:select-text">
          {pageSection ? (
            <div className="absolute inset-0 overflow-y-auto rounded-2xl border border-page-line bg-white/95 p-5">
              {pageSection.panel()}
            </div>
          ) : null}
        </aside>

        <div className="flex min-w-0 flex-col gap-4">
        {/* The page and the strip of pages under it, at one width: the strip
            is the book's own pages, so it is as wide as a page is.

            One page in view at every width, chevrons either side of it on a
            phone as on a desktop. What the carousel below never does is show
            a slice of the next page beside it: a page drawn narrower than the
            window is a page set for the wrong trim. */}
        <div className="mx-auto flex w-full max-w-[min(100%,calc(100dvh-9rem))] flex-col gap-4">
        <div className="relative">
          <div
            className="relative w-full touch-pan-y select-none"
            onPointerDown={onPagePointerDown}
            onPointerMove={onPagePointerMove}
            onPointerUp={endPageSwipe}
            onPointerCancel={endPageSwipe}
            // A drag that ends on the zoom button, or on a chevron, was a
            // drag and not a tap.
            onClickCapture={(event) => {
              if (!justSwiped.current) return;
              justSwiped.current = false;
              event.preventDefault();
              event.stopPropagation();
            }}
          >
            {/*
             * The carousel: the book's pages in one long row, each exactly a
             * page wide, behind a window exactly one page wide.
             *
             * The page used to be the only thing rendered, so turning one
             * swapped the canvas underneath and the neighbour was never there
             * to see — a swipe slid the page you were leaving off an empty
             * background. The pages either side are really in the track now,
             * so pushing the book sideways brings the next one in under your
             * thumb and letting go carries it the rest of the way.
             *
             * One page in the window, at every width. The peek-at-the-
             * neighbours treatment this replaces sized each slide to a
             * fraction of the viewport, and `PageCanvas` measures its type in
             * `cqw` — a page squeezed into a partial-width slide came out set
             * for a page that width, which is not the book anyone is buying.
             */}
            <div className="relative overflow-hidden rounded-xl bg-white shadow-[0_18px_50px_-24px_rgb(25_32_58/0.5)] ring-1 ring-page-line">
              {/* The row itself. Its width is the window's, so one page of
                  travel is one hundred per cent of it, and the drag rides on
                  top of that in pixels. */}
              <div
                className="flex w-full"
                style={{
                  transform: `translateX(calc(${position * -100}% + ${drag}px))`,
                  transition: drag ? "none" : "transform 220ms cubic-bezier(0.22, 1, 0.36, 1)",
                }}
              >
                {slides.map((item, index) => (
                  <div
                    key={item.key}
                    // Each page clips its own: a locked neighbour is blurred,
                    // and a blur paints past the box it is on — without this
                    // the page being read picks up a smear of the next one
                    // along its edge.
                    className="relative w-full shrink-0 overflow-hidden"
                    // Only the page in the window is being read. The rest are
                    // off its edges, and a five-hundred-page book read out in
                    // sequence is nobody's idea of this screen.
                    aria-hidden={index !== position}
                  >
                    <div className={item.locked ? "blur-[7px] saturate-50" : ""}>
                      {Math.abs(index - position) > CANVAS_WINDOW ? (
                        // Its place, held at the same size, until it is close
                        // enough to be worth drawing. A whole book of real
                        // canvases would decode every photograph in it to fill
                        // a row that shows one page.
                        <div className="aspect-square w-full bg-white" />
                      ) : item.page ? (
                        <PageCanvas
                          page={item.page}
                          meta={meta}
                          chapters={chapters}
                          photos={photoMap}
                          placeholder={item.locked}
                        />
                      ) : (
                        <CoverCanvas meta={meta} photos={photoList} />
                      )}
                    </div>

                    {item.locked ? (
                      // A label, not a control — the actual way through is the
                      // account CTA below (LockedWall or, here, the sidebar),
                      // never two competing buttons on the same locked page.
                      <div className="absolute inset-0 flex items-center justify-center bg-white/45 p-5">
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-white/90 px-4 py-2 text-sm font-semibold text-page-ink-soft shadow-sm">
                          <Lock aria-hidden className="size-3.5" />
                          Sign up to view this page
                        </span>
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>

              {/* Set body text on a page this size reads around six pixels on
                  a phone. This is the way to actually read it. One button for
                  whatever is in the window, sitting still while the pages move
                  under it, rather than one per page riding past with them. */}
              {slide.locked ? null : (
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
        <div className="overflow-hidden rounded-xl border border-page-line">
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
        </div>

        {slide.locked ? (
          <div className="mx-auto w-full max-w-2xl">
            <LockedWall
              petName={meta.petName}
              hiddenPages={teaser.hiddenPages}
              hiddenChapters={teaser.hiddenChapters}
              onUnlock={onUnlock}
            />
          </div>
        ) : null}

        {/* Download, below the book on narrow screens. No free-pages
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

        {/* Room for the dock to float over, so the last control on the page
            is never under it. */}
          {dockSections.length > 0 ? <div aria-hidden className="h-16 lg:hidden" /> : null}
        </div>

        {/* The design belongs to the whole book, so it sits under the whole
            book — a second row of the editor, under the carousel and under
            the tools, spanning both. Keeping it out of the book's own column
            is also what lets the tools end level with the carousel instead of
            running on down the side of a panel that is not theirs. */}
        {showDesignBelow ? (
          <div className="hidden select-none rounded-2xl border border-page-line bg-white/95 p-5 lg:col-span-2 lg:block">
            {designPanel()}
          </div>
        ) : null}
      </div>

      <ToolsDock sections={dockSections} />
    </div>
  );
}