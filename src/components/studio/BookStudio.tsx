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
import { buildSlides, followSelection } from "@/lib/book/studio";
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

/** Pixels of travel before a press on the page counts as a drag, not a click. */
const PAN_SLOP = 5;

/**
 * How long the carousel must sit still before it counts as having stopped.
 *
 * `scrollend` would say this exactly, and is still missing from browsers this
 * book has to open in; a moment of quiet after the last scroll event says the
 * same thing everywhere, and once a page has snapped there is nothing left to
 * move.
 */
const SETTLE_MS = 120;

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

  /**
   * Moving the book sideways.
   *
   * The carousel is a scroller, not a slideshow the page is posted into, so
   * every way of scrolling something horizontally moves the book: a finger, a
   * trackpad, a shift-wheel, a scrollbar gesture on a tablet. Mandatory snap
   * points mean it can only ever come to rest on one whole page, whichever of
   * those did the moving. Before this it answered to one hand-rolled pointer
   * drag and nothing else — the arrows and the strip turned pages and the page
   * itself could not be pushed at all on a trackpad.
   *
   * A mouse has no horizontal scroll of its own, so a press and a pull still
   * drives the scroller directly, the same way the filmstrip's does. Snapping
   * is switched off for the length of that drag: with it on, every `scrollLeft`
   * the handler writes is pulled straight back to the nearest page, so the
   * book jumped a page at a time instead of following the hand. Putting it
   * back at the end of the drag is also what settles the book on one page.
   */
  const carouselRef = useRef<HTMLDivElement>(null);
  /** Set while the customer is dragging the carousel with a pointer. */
  const panning = useRef(false);
  /** Where the drag began, and how far it has travelled. */
  const panOrigin = useRef({ x: 0, scrollLeft: 0, moved: 0 });
  /** True from the end of a drag until the click it would otherwise fire. */
  const justPanned = useRef(false);
  /**
   * Set when the selection changed because the carousel scrolled.
   *
   * The two follow each other — scrolling picks the page, and picking a page
   * scrolls to it — so one of the directions has to say so, or a scroll would
   * be answered by a scroll back to where it started.
   */
  const fromScroll = useRef(false);
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /**
   * A page's width, which is the window's.
   *
   * Measured rather than taken from `clientWidth`, which is rounded to whole
   * pixels: the book's column is a share of the viewport and lands on
   * fractions of one, and a third of a pixel per page is four pixels out by
   * page twelve — enough for the carousel and the page it thinks it is on to
   * start correcting each other.
   */
  const pageWidth = (el: HTMLDivElement): number =>
    el.getBoundingClientRect().width || el.clientWidth || 1;

  /** Which page the carousel is resting on, if it is resting on one. */
  const pageUnderWindow = (el: HTMLDivElement): number =>
    Math.min(
      Math.max(Math.round(el.scrollLeft / pageWidth(el)), 0),
      slides.length - 1,
    );

  /**
   * Whatever page the carousel came to rest on is the page being read.
   *
   * Read once the movement has stopped rather than on every scroll frame. A
   * frame reader answers a smooth scroll of its own making with the page it
   * happens to be passing through, so one press of a chevron selected the page
   * in between and then the page asked for — the label, the tools and the
   * strip all flickering through a page nobody chose.
   */
  const settle = (): void => {
    const el = carouselRef.current;
    if (!el || el.clientWidth === 0) return;
    const page = pageUnderWindow(el);
    if (page === position) return;
    fromScroll.current = true;
    setSelected(page);
  };

  const onCarouselScroll = (): void => {
    if (settleTimer.current) clearTimeout(settleTimer.current);
    settleTimer.current = setTimeout(settle, SETTLE_MS);
  };

  const startPan = (event: React.PointerEvent<HTMLDivElement>): void => {
    // A finger already scrolls this natively; driving scrollLeft as well moves
    // it twice as far as the hand and fights the momentum.
    if (event.button !== 0 || event.pointerType === "touch" || zoomed) return;
    const el = carouselRef.current;
    if (!el) return;
    panning.current = true;
    panOrigin.current = { x: event.clientX, scrollLeft: el.scrollLeft, moved: 0 };
  };

  const pan = (event: React.PointerEvent<HTMLDivElement>): void => {
    const el = carouselRef.current;
    if (!panning.current || !el) return;
    const travelled = event.clientX - panOrigin.current.x;
    panOrigin.current.moved = Math.max(panOrigin.current.moved, Math.abs(travelled));
    // Until it is clearly a drag it may still be a click on the page.
    if (panOrigin.current.moved <= PAN_SLOP) return;
    if (!el.hasPointerCapture(event.pointerId)) el.setPointerCapture(event.pointerId);
    el.style.scrollSnapType = "none";
    el.scrollLeft = panOrigin.current.scrollLeft - travelled;
  };

  const endPan = (event: React.PointerEvent<HTMLDivElement>): void => {
    const el = carouselRef.current;
    if (el?.hasPointerCapture(event.pointerId)) el.releasePointerCapture(event.pointerId);
    if (!panning.current) return;
    panning.current = false;
    const dragged = panOrigin.current.moved > PAN_SLOP;
    // The click this pointer is about to fire belongs to the drag, not to
    // whatever it happened to finish on top of.
    justPanned.current = dragged;
    if (!el || !dragged) return;
    const page = pageUnderWindow(el);
    el.style.scrollSnapType = "";
    // Restoring the snap settles it, but on our terms rather than every
    // browser's: whichever page the window is most of the way onto.
    el.scrollTo({ left: page * pageWidth(el), behavior: "smooth" });
  };

  /**
   * The carousel follows the selection — from the arrows, the strip, the
   * keyboard, or a page that has just been repaginated out from under it.
   *
   * A move of one page is worth watching; a jump of twenty is twenty blank
   * pages flickering past, so anything further than a neighbour simply lands.
   */
  useEffect(() => {
    const el = carouselRef.current;
    if (!el || el.clientWidth === 0) return;
    // This selection came from the scroller; scrolling it again would be an
    // argument with the hand that is still moving it.
    if (fromScroll.current) {
      fromScroll.current = false;
      return;
    }
    if (panning.current) return;
    const width = pageWidth(el);
    const target = position * width;
    const away = Math.abs(el.scrollLeft - target);
    // Under half a pixel out is the carousel already being where it belongs.
    if (away < 0.5) return;
    el.scrollTo({ left: target, behavior: away > width * 1.5 ? "auto" : "smooth" });
  }, [position]);

  useEffect(
    () => () => {
      if (settleTimer.current) clearTimeout(settleTimer.current);
    },
    [],
  );

  /**
   * Staying on the page you are editing while the book is repaginated.
   *
   * Every edit rebuilds the pages, and a page can come out of that rebuild at
   * a different index or not come out of it at all — `followSelection` is
   * where that is worked out. Without it, choosing a layout that used up the
   * chapter's last page left the selection meaning the next chapter's opener,
   * and the editor jumped there while somebody was still working.
   */
  const shelf = useRef(slides);
  useEffect(() => {
    const before = shelf.current;
    shelf.current = slides;
    if (before === slides) return;
    const next = followSelection(before, slides, selected);
    if (next !== selected) setSelected(next);
  }, [slides, selected]);

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
            className="relative w-full select-none"
            // A drag that ends on the zoom button, or on a chevron, was a
            // drag and not a tap.
            onClickCapture={(event) => {
              if (!justPanned.current) return;
              justPanned.current = false;
              event.preventDefault();
              event.stopPropagation();
            }}
          >
            {/*
             * The carousel: the book's pages in one long row, each exactly a
             * page wide, in a scroller whose window is exactly one page wide.
             *
             * The page used to be the only thing rendered, so turning one
             * swapped the canvas underneath and the neighbour was never there
             * to see. The pages either side are really in the row now, and the
             * row is scrolled rather than posted from page to page, so every
             * way of moving something sideways moves the book and mandatory
             * snap points stop it anywhere but on one whole page.
             *
             * One page in the window, at every width. The peek-at-the-
             * neighbours treatment this replaces sized each slide to a
             * fraction of the viewport, and `PageCanvas` measures its type in
             * `cqw` — a page squeezed into a partial-width slide came out set
             * for a page that width, which is not the book anyone is buying.
             */}
            <div
              ref={carouselRef}
              onScroll={onCarouselScroll}
              onPointerDown={startPan}
              onPointerMove={pan}
              onPointerUp={endPan}
              onPointerCancel={endPan}
              // A page's own photograph is an image, and an image dragged with
              // a mouse starts a native drag-and-drop, which cancels the
              // pointer stream the pan above is following.
              onDragStart={(event) => event.preventDefault()}
              className="page-carousel flex w-full cursor-grab snap-x snap-mandatory overflow-x-auto overflow-y-hidden rounded-xl bg-white shadow-[0_18px_50px_-24px_rgb(25_32_58/0.5)] ring-1 ring-page-line active:cursor-grabbing"
            >
              {slides.map((item, index) => (
                <div
                  key={item.key}
                  // Each page clips its own: a locked neighbour is blurred,
                  // and a blur paints past the box it is on — without this
                  // the page being read picks up a smear of the next one
                  // along its edge.
                  className="relative w-full shrink-0 snap-start overflow-hidden"
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

            {/* Set body text on a page this size reads around six pixels on a
                phone. This is the way to actually read it. One button for
                whatever is in the window, and outside the scroller rather than
                in it: anything positioned inside a scroller scrolls away with
                the pages. */}
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