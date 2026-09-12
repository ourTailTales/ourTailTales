"use client";

import { motion } from "motion/react";
import { useMemo, useState, type DragEvent, type ReactNode } from "react";

import {
  BackCover,
  BookCover,
  CaseSpine,
  PAGE_BLOCK_Z,
  PAGE_CASE_RIM,
  PAGE_SPINE_INSET,
  PageStack,
} from "@/components/hero/BookCover";
import {
  BookSpread,
  PAPER_INSET,
  PAPER_RADIUS,
} from "@/components/hero/BookPage";
import { FoundPage, MetaPage, SizePages } from "@/components/hero/funnelSpreads";
import { HeroUploadZone } from "@/components/hero/HeroUploadZone";
import { InBookPreview } from "@/components/hero/InBookPreview";
import { PhotoImportAnimation } from "@/components/hero/PhotoImportAnimation";
import {
  usePrefersReducedMotion,
  useTouchPrimary,
} from "@/components/hero/useHeroMedia";
import { brand } from "@/lib/brand";
import { filesFromDataTransfer } from "@/lib/photo/process";
import { formatUsd, bookSpec } from "@/lib/pricing";
import { possessivePetName } from "@/lib/book/pagination";
import {
  photoMapOf,
  summarizeAlbum,
  useOurTailTalesStore,
} from "@/store/useOurTailTalesStore";

type HeroPhase =
  | "closed"
  | "open"
  | "processing"
  | "album"
  | "configure"
  | "story";

const sceneEase = [0.22, 0.9, 0.28, 1] as const;

export function InteractiveBookHero({
  onFiles,
  onCancel,
  onStartOver,
  onMetaContinue,
  onConfirmSize,
  onBackToAlbum,
  onCreateStory,
  onSample,
  onCheckout,
  notice,
}: {
  onFiles: (files: File[]) => void;
  onCancel: () => void;
  onStartOver: () => void;
  onMetaContinue: () => void;
  onConfirmSize: () => void;
  onBackToAlbum: () => void;
  onCreateStory: () => void;
  onSample: () => void;
  onCheckout: () => void;
  notice?: string | null;
}) {
  const funnelState = useOurTailTalesStore((state) => state.funnelState);
  const progress = useOurTailTalesStore((state) => state.progress);
  const photos = useOurTailTalesStore((state) => state.photos);
  const processingError = useOurTailTalesStore((state) => state.processingError);
  const chapterCount = useOurTailTalesStore((state) => state.chapterCount);
  const meta = useOurTailTalesStore((state) => state.meta);
  const pages = useOurTailTalesStore((state) => state.pages);
  const chapters = useOurTailTalesStore((state) => state.chapters);
  const exportMessage = useOurTailTalesStore((state) => state.exportMessage);
  const setMeta = useOurTailTalesStore((state) => state.setMeta);
  const setChapterCount = useOurTailTalesStore((state) => state.setChapterCount);

  const reducedMotion = usePrefersReducedMotion();
  const touchPrimary = useTouchPrimary();

  const summary = useMemo(() => summarizeAlbum(photos), [photos]);
  const photoMap = useMemo(() => photoMapOf(photos), [photos]);
  const spec = useMemo(() => bookSpec(chapterCount), [chapterCount]);

  const lockedOpen =
    funnelState !== "idle" || photos.length > 0;

  const [hoverOpen, setHoverOpen] = useState(false);
  const [tapOpen, setTapOpen] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [sceneReading, setSceneReading] = useState(false);

  const engaged = tapOpen || lockedOpen || dragOver;
  const open = lockedOpen || hoverOpen || tapOpen || dragOver;

  const phase: HeroPhase = (() => {
    if (funnelState === "processing") return "processing";
    if (funnelState === "album_ready") return "album";
    if (funnelState === "configure") return "configure";
    if (
      funnelState === "organizing" ||
      funnelState === "ai_generating" ||
      funnelState === "editing" ||
      funnelState === "exporting"
    ) {
      return "story";
    }
    return open ? "open" : "closed";
  })();

  const inProduct = phase === "album" || phase === "configure" || phase === "story";
  const acceptUploads = phase === "open" || phase === "closed";

  const thumbUrls = useMemo(
    () => photos.slice(0, 48).map((photo) => photo.thumbUrl).filter(Boolean),
    [photos],
  );

  const pageActivity =
    phase === "processing"
      ? Math.min(1, progress.processed / Math.max(1, progress.total))
      : 0;

  const lockOpen = (): void => setTapOpen(true);

  const handleSceneDragEnter = (event: DragEvent<HTMLDivElement>): void => {
    if (!acceptUploads) return;
    event.preventDefault();
    lockOpen();
    setDragOver(true);
  };

  const handleSceneDragOver = (event: DragEvent<HTMLDivElement>): void => {
    if (!acceptUploads) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    lockOpen();
    setDragOver(true);
  };

  const handleSceneDragLeave = (event: DragEvent<HTMLDivElement>): void => {
    const next = event.relatedTarget as Node | null;
    if (next && event.currentTarget.contains(next)) return;
    setDragOver(false);
  };

  const handleSceneDrop = (event: DragEvent<HTMLDivElement>): void => {
    if (!acceptUploads) return;
    event.preventDefault();
    event.stopPropagation();
    setDragOver(false);
    lockOpen();
    void (async () => {
      setSceneReading(true);
      try {
        const files = await filesFromDataTransfer(event.dataTransfer);
        if (files.length > 0) onFiles(files);
      } finally {
        setSceneReading(false);
      }
    })();
  };

  const { left, right, bleed } = resolveSpread({
    phase,
    progress,
    summary,
    meta,
    setMeta,
    setChapterCount,
    onMetaContinue,
    onConfirmSize,
    onBackToAlbum,
    onStartOver,
    dragOver,
    setDragOver,
    lockOpen,
    sceneReading,
    onFiles,
    onCancel,
    chapterCount,
    pages,
    chapters,
    photoMap,
  });

  const storyDone = chapters.filter((chapter) => chapter.aiStatus === "done").length;

  return (
    <section className="relative mx-auto w-full max-w-5xl">
      {!inProduct && (
        <h1 className="sr-only">{brand.title}</h1>
      )}

      {phase === "story" && (
        <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="font-display text-2xl text-ink sm:text-3xl">
              {possessivePetName(meta.petName)} story
            </h2>
            <p className="mt-1 text-sm text-ink-soft">
              {spec.chapterCount} chapters · {spec.storyPages} story pages +{" "}
              {spec.fixedPages} complimentary · {formatUsd(spec.price)}
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            {funnelState === "organizing" && (
              <button
                type="button"
                onClick={onCreateStory}
                className="rounded-xl bg-periwinkle px-5 py-2.5 text-sm font-semibold text-white shadow-lift transition-colors hover:bg-periwinkle-deep"
              >
                Create My Story
              </button>
            )}
            {funnelState === "editing" && (
              <>
                <button
                  type="button"
                  onClick={onSample}
                  className="rounded-xl border border-line px-4 py-2.5 text-sm text-ink-soft transition-colors hover:border-periwinkle hover:text-periwinkle-deep"
                >
                  See 5 pages free
                </button>
                <button
                  type="button"
                  onClick={onCheckout}
                  className="rounded-xl bg-periwinkle px-5 py-2.5 text-sm font-semibold text-white shadow-lift transition-colors hover:bg-periwinkle-deep"
                >
                  Order — {formatUsd(spec.price)}
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {funnelState === "organizing" && (
        <p className="mb-4 rounded-2xl border border-sage/60 bg-sage/40 px-4 py-3 text-sm leading-6 text-ink-soft">
          <strong className="font-medium text-ink">Before you continue:</strong>{" "}
          Create My Story sends a few small previews per chapter — not your full
          album — so introductions can be written.
        </p>
      )}

      {funnelState === "ai_generating" && (
        <p
          role="status"
          className="mb-4 rounded-2xl border border-line bg-lavender/40 px-4 py-3 text-sm text-ink-soft"
        >
          Writing your chapters — {storyDone} of {chapters.length} done.
        </p>
      )}

      {funnelState === "exporting" && (
        <p
          role="status"
          className="mb-4 rounded-xl border border-periwinkle/30 bg-periwinkle-wash/40 px-4 py-3 text-sm text-periwinkle-deep"
        >
          {exportMessage ?? "Preparing your book…"}
        </p>
      )}

      {notice && (
        <p role="alert" className="mb-4 text-sm text-periwinkle-deep">
          {notice}
        </p>
      )}

      <div
        className={`relative mx-auto w-full touch-manipulation ${
          inProduct ? "max-w-[min(100%,48rem)]" : "max-w-[min(100%,40rem)]"
        }`}
        style={{ perspective: touchPrimary ? "1200px" : "1680px" }}
        onMouseEnter={() => {
          if (!touchPrimary && !engaged) setHoverOpen(true);
        }}
        onMouseLeave={() => {
          if (!touchPrimary && !engaged && !dragOver) setHoverOpen(false);
        }}
        onDragEnter={handleSceneDragEnter}
        onDragOver={handleSceneDragOver}
        onDragLeave={handleSceneDragLeave}
        onDrop={handleSceneDrop}
      >
        <motion.div
          aria-hidden
          className="pointer-events-none absolute bottom-[4%] left-1/2 h-[12%] w-[78%] -translate-x-1/2 rounded-[100%] bg-ink/20 blur-2xl"
          animate={{
            opacity: open ? 0.28 : 0.4,
            scaleX: open ? 1.12 : 0.92,
            scaleY: open ? 0.85 : 1,
          }}
          transition={{ duration: 1, ease: sceneEase }}
        />

        <div
          className={`relative mx-auto w-full ${
            inProduct ? "aspect-[1.2/1]" : "aspect-[1.05/1]"
          }`}
        >
          <motion.div
            className="absolute inset-[4%] sm:inset-[3.5%]"
            style={{
              // Closed: depth so the back board recedes behind the cover.
              // Open: flat for reliable page hit-testing / clipping.
              transformStyle: open || reducedMotion ? "flat" : "preserve-3d",
            }}
            animate={
              reducedMotion
                ? { rotateX: 0, rotateY: 0, y: 0 }
                : {
                    // Tip the whole book toward the camera (same direction as the ajar cover).
                    rotateX: open ? 0 : -8,
                    rotateY: open ? 0 : 10,
                    y: open ? -4 : 2,
                  }
            }
            transition={{ duration: 1.05, ease: sceneEase }}
          >
            {/*
              Same footprint as the front cover. Back sits farther in Z so
              perspective keeps it mostly hidden; pages nest between.
            */}
            <BackCover open={open} reducedMotion={reducedMotion} />

            <div
              className="absolute z-10"
              style={
                open
                  ? {
                      inset: PAPER_INSET,
                      borderRadius: PAPER_RADIUS,
                      overflow: "hidden",
                    }
                  : {
                      top: PAGE_CASE_RIM,
                      right: PAGE_CASE_RIM,
                      bottom: PAGE_CASE_RIM,
                      left: PAGE_SPINE_INSET,
                      borderRadius: `0 ${PAPER_RADIUS}px ${PAPER_RADIUS}px 0`,
                      overflow: "hidden",
                      transform: reducedMotion
                        ? undefined
                        : `translateZ(${PAGE_BLOCK_Z}px) scale(0.985)`,
                      transformOrigin: "center center",
                    }
              }
            >
              <div
                className="relative h-full w-full"
                style={{
                  borderRadius: "inherit",
                  overflow: open ? "hidden" : "visible",
                }}
              >
                <PageStack activity={pageActivity} open={open} ajar={!open && !reducedMotion} />
                <div
                  className="absolute inset-0 z-10 overflow-hidden"
                  style={{ borderRadius: "inherit" }}
                >
                  {bleed ? (
                    <div
                      className="absolute inset-0 overflow-hidden bg-white shadow-[inset_0_0_0_1px_rgb(37_42_58/0.05)]"
                      style={{ borderRadius: "inherit" }}
                    >
                      {bleed}
                    </div>
                  ) : (
                    <BookSpread
                      open={open}
                      pageActivity={pageActivity}
                      reducedMotion={reducedMotion}
                      left={left}
                      right={right}
                    />
                  )}
                </div>
              </div>
            </div>

            <CaseSpine open={open} />

            <div
              className={`absolute inset-0 z-20 ${open ? "pointer-events-none" : ""}`}
              style={{
                transformStyle: "preserve-3d",
                transformOrigin: "left center",
                pointerEvents: open ? "none" : undefined,
              }}
            >
              <BookCover
                open={open}
                reducedMotion={reducedMotion}
                onOpenIntent={lockOpen}
              />
            </div>

            <PhotoImportAnimation
              thumbUrls={thumbUrls}
              active={phase === "processing"}
              reducedMotion={reducedMotion}
              isMobile={touchPrimary}
            />
          </motion.div>
        </div>
      </div>

      {processingError && (
        <p role="alert" className="mt-4 text-center text-sm text-periwinkle-deep">
          {processingError}
        </p>
      )}

      {phase === "closed" && (
        <p className="mt-6 text-center text-sm text-ink-faint">
          {touchPrimary
            ? "Tap the cover to open — or drop their album on it."
            : "Hover or tap the cover to open — or drop their album onto the book."}
        </p>
      )}
    </section>
  );
}

function resolveSpread(args: {
  phase: HeroPhase;
  progress: { processed: number; total: number; phase: string; failed: number };
  summary: ReturnType<typeof summarizeAlbum>;
  meta: ReturnType<typeof useOurTailTalesStore.getState>["meta"];
  setMeta: (patch: Partial<ReturnType<typeof useOurTailTalesStore.getState>["meta"]>) => void;
  setChapterCount: (count: number) => void;
  onMetaContinue: () => void;
  onConfirmSize: () => void;
  onBackToAlbum: () => void;
  onStartOver: () => void;
  dragOver: boolean;
  setDragOver: (value: boolean) => void;
  lockOpen: () => void;
  sceneReading: boolean;
  onFiles: (files: File[]) => void;
  onCancel: () => void;
  chapterCount: number;
  pages: ReturnType<typeof useOurTailTalesStore.getState>["pages"];
  chapters: ReturnType<typeof useOurTailTalesStore.getState>["chapters"];
  photoMap: Map<string, import("@/types/photo").PhotoAsset>;
}): { left: ReactNode; right: ReactNode; bleed?: ReactNode } {
  const {
    phase,
    progress,
    summary,
    meta,
    setMeta,
    setChapterCount,
    onMetaContinue,
    onConfirmSize,
    onBackToAlbum,
    onStartOver,
    dragOver,
    setDragOver,
    lockOpen,
    sceneReading,
    onFiles,
    onCancel,
    chapterCount,
    pages,
    chapters,
    photoMap,
  } = args;

  if (phase === "processing") {
    return {
      left: (
        <div className="flex h-full flex-col justify-center">
          <p className="font-display text-xl leading-snug text-ink sm:text-2xl">
            {processingHeadline(progress)}
          </p>
          <p className="mt-3 text-sm leading-5 text-ink-soft">
            {progress.total > 0
              ? `${progress.processed.toLocaleString()} of ${progress.total.toLocaleString()} read so far.`
              : "A few at a time, so your browser stays responsive."}
          </p>
          <div
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={
              progress.total === 0
                ? 0
                : Math.min(100, Math.round((progress.processed / progress.total) * 100))
            }
            className="mt-5 h-1.5 overflow-hidden rounded-full bg-white/80"
          >
            <div
              className="h-full rounded-full bg-periwinkle transition-[width] duration-200"
              style={{
                width: `${
                  progress.total === 0
                    ? 0
                    : Math.min(100, Math.round((progress.processed / progress.total) * 100))
                }%`,
              }}
            />
          </div>
        </div>
      ),
      right: (
        <div className="flex h-full flex-col justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-ink-faint">
              On your device
            </p>
            <p className="mt-2 text-sm leading-5 text-ink-soft">
              Originals stay local. We only read what we need to shape the chapters.
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="self-start rounded-xl border border-line px-3 py-1.5 text-xs font-medium text-ink-soft transition-colors hover:border-periwinkle hover:text-periwinkle-deep"
          >
            Cancel
          </button>
        </div>
      ),
    };
  }

  if (phase === "album") {
    return {
      left: <FoundPage summary={summary} />,
      right: (
        <MetaPage
          summary={summary}
          meta={meta}
          onMetaChange={setMeta}
          onContinue={onMetaContinue}
          onStartOver={onStartOver}
        />
      ),
    };
  }

  if (phase === "configure") {
    return SizePages({
      chapterCount,
      maxChapters: summary.maxChapters,
      placeablePhotos: summary.placeable,
      onChange: setChapterCount,
      onConfirm: onConfirmSize,
      onBack: onBackToAlbum,
    });
  }

  if (phase === "story") {
    return {
      left: null,
      right: null,
      bleed: (
        <InBookPreview
          pages={pages}
          chapters={chapters}
          meta={meta}
          photos={photoMap}
        />
      ),
    };
  }

  return {
    left: (
      <div className="flex h-full flex-col justify-center">
        <p className="font-cover text-xl font-semibold leading-snug text-ink sm:text-2xl">
          Drop in their album
        </p>
        <p className="mt-3 text-sm leading-5 text-ink-soft">
          We&rsquo;ll find the chapters on your device — then shape a hardcover
          you can hold.
        </p>
      </div>
    ),
    right: (
      <HeroUploadZone
        onFiles={(files) => {
          lockOpen();
          onFiles(files);
        }}
        isOver={dragOver}
        onDragState={setDragOver}
        onInteract={lockOpen}
        disabled={sceneReading}
      />
    ),
  };
}

function processingHeadline(progress: {
  processed: number;
  total: number;
  phase: string;
}): string {
  if (progress.phase === "reading" || progress.phase === "thumbnails") {
    if (progress.total > 0) {
      return `Reading ${progress.total.toLocaleString()} memories…`;
    }
    return "Reading their memories…";
  }
  if (progress.phase === "deduplicating") return "Organizing their timeline…";
  if (progress.phase === "sorting") return "Finding meaningful chapters…";
  return "Gathering their story…";
}
