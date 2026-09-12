"use client";

import { useMemo, useState, type DragEvent, type ReactNode } from "react";

import { BookViewer } from "@/components/book-viewer/BookViewer";
import {
  BackCoverArt,
  CoverFrontArt,
  CoverInsideArt,
} from "@/components/book-viewer/CoverArt";
import type { FlipSheet } from "@/components/book-viewer/types";
import { HeroUploadZone } from "@/components/hero/HeroUploadZone";
import { FoundPage, MetaPage, SizePages } from "@/components/hero/funnelSpreads";
import { PagePreview } from "@/components/PagePreview";
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

/**
 * Funnel adapter: builds FlipSheets from store state and mounts BookViewer.
 * Replaces InteractiveBookHero as the book shell.
 */
export function FunnelBookHero({
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

  const summary = useMemo(() => summarizeAlbum(photos), [photos]);
  const photoMap = useMemo(() => photoMapOf(photos), [photos]);
  const spec = useMemo(() => bookSpec(chapterCount), [chapterCount]);

  const lockedOpen = funnelState !== "idle" || photos.length > 0;
  const [dragOver, setDragOver] = useState(false);
  const [sceneReading, setSceneReading] = useState(false);
  const [bookOpened, setBookOpened] = useState(lockedOpen);

  const open = lockedOpen || bookOpened || dragOver;

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

  const acceptUploads = phase === "open" || phase === "closed";

  const sheets = useMemo(
    () =>
      buildFunnelSheets({
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
        onFiles: (files) => {
          setBookOpened(true);
          onFiles(files);
        },
        onCancel,
        chapterCount,
        pages,
        chapters,
        photoMap,
        sceneReading,
      }),
    [
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
      onFiles,
      onCancel,
      chapterCount,
      pages,
      chapters,
      photoMap,
      sceneReading,
    ],
  );

  const handleDragEnter = (event: DragEvent<HTMLElement>): void => {
    if (!acceptUploads) return;
    event.preventDefault();
    setBookOpened(true);
    setDragOver(true);
  };

  const handleDragOver = (event: DragEvent<HTMLElement>): void => {
    if (!acceptUploads) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    setBookOpened(true);
    setDragOver(true);
  };

  const handleDragLeave = (event: DragEvent<HTMLElement>): void => {
    const next = event.relatedTarget as Node | null;
    if (next && event.currentTarget.contains(next)) return;
    setDragOver(false);
  };

  const handleDrop = (event: DragEvent<HTMLElement>): void => {
    if (!acceptUploads) return;
    event.preventDefault();
    event.stopPropagation();
    setDragOver(false);
    setBookOpened(true);
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

  const storyDone = chapters.filter((chapter) => chapter.aiStatus === "done").length;
  const showStoryChrome =
    phase === "story" &&
    (funnelState === "organizing" ||
      funnelState === "editing" ||
      funnelState === "ai_generating");

  return (
    <section
      className="relative"
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <h1 className="sr-only">{meta.petName ? `${possessivePetName(meta.petName)} story` : "Their photo album becomes a book you can hold."}</h1>

      {showStoryChrome && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-display text-xl text-ink sm:text-2xl">
              {possessivePetName(meta.petName || "Your pet")} story
            </p>
            <p className="mt-1 text-sm text-ink-soft">
              {chapterCount} chapters · {formatUsd(spec.price)} hardcover
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {funnelState === "organizing" && (
              <button
                type="button"
                onClick={onCreateStory}
                className="rounded-xl bg-periwinkle px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-periwinkle-deep"
              >
                Create My Story
              </button>
            )}
            {(funnelState === "organizing" || funnelState === "editing") && (
              <button
                type="button"
                onClick={onSample}
                className="rounded-xl border border-line px-4 py-2 text-sm font-medium text-ink-soft transition-colors hover:border-periwinkle hover:text-periwinkle-deep"
              >
                Email me a sample
              </button>
            )}
            {funnelState === "editing" && (
              <button
                type="button"
                onClick={onCheckout}
                className="rounded-xl bg-periwinkle px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-periwinkle-deep"
              >
                Order hardcover · {formatUsd(spec.price)}
              </button>
            )}
          </div>
        </div>
      )}

      {funnelState === "ai_generating" && (
        <p role="status" className="mb-4 rounded-2xl border border-line bg-lavender/40 px-4 py-3 text-sm text-ink-soft">
          Writing your chapters — {storyDone} of {chapters.length} done.
        </p>
      )}

      {funnelState === "exporting" && (
        <p role="status" className="mb-4 rounded-xl border border-periwinkle/30 bg-periwinkle-wash/40 px-4 py-3 text-sm text-periwinkle-deep">
          {exportMessage ?? "Preparing your book…"}
        </p>
      )}

      {notice && (
        <p role="alert" className="mb-4 text-sm text-periwinkle-deep">
          {notice}
        </p>
      )}

      <BookViewer
        sheets={sheets}
        initialPage={lockedOpen || bookOpened ? 1 : 0}
        preferSingleFirstLeaf={phase === "closed" || phase === "open"}
        // Funnel steps stay on the current spread until the user finishes that step.
        // Story pages may turn freely.
        maxPage={phase === "story" ? undefined : 1}
        onCoverOpened={() => setBookOpened(true)}
        hideNav={phase === "closed" && !bookOpened}
      />

      {processingError && (
        <p role="alert" className="mt-4 text-center text-sm text-periwinkle-deep">
          {processingError}
        </p>
      )}

      {phase === "closed" && !bookOpened && (
        <p className="mt-4 text-center text-sm text-ink-faint">
          Click the cover to open — or drop their album onto the book.
        </p>
      )}
    </section>
  );
}

function buildFunnelSheets(args: {
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
  onFiles: (files: File[]) => void;
  onCancel: () => void;
  chapterCount: number;
  pages: ReturnType<typeof useOurTailTalesStore.getState>["pages"];
  chapters: ReturnType<typeof useOurTailTalesStore.getState>["chapters"];
  photoMap: Map<string, import("@/types/photo").PhotoAsset>;
  sceneReading: boolean;
}): FlipSheet[] {
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
    onFiles,
    onCancel,
    chapterCount,
    pages,
    chapters,
    photoMap,
    sceneReading,
  } = args;

  const { left, right } = resolveInterior(args);

  const sheets: FlipSheet[] = [
    {
      id: "cover",
      kind: "hard",
      front: <CoverFrontArt />,
      // Blank endpaper — left peek stays empty in single-page view.
      // For album/configure/processing spreads, left content lives on the cover back
      // so page 1 reads as left|right.
      back:
        phase === "album" || phase === "configure" || phase === "processing" ? (
          <PageShell>{left}</PageShell>
        ) : (
          <CoverInsideArt />
        ),
    },
  ];

  if (phase === "story" && pages.length > 0) {
    for (let i = 0; i < pages.length; i += 2) {
      const frontPage = pages[i]!;
      const backPage = pages[i + 1];
      const frontChapter = chapters.find((entry) => entry.id === frontPage.chapterId);
      const backChapter = backPage
        ? chapters.find((entry) => entry.id === backPage.chapterId)
        : undefined;
      sheets.push({
        id: `story-${frontPage.id}`,
        kind: "soft",
        front: (
          <div data-bv-bleed className="h-full w-full overflow-hidden bg-white">
            <PagePreview
              page={frontPage}
              chapter={frontChapter}
              meta={meta}
              photos={photoMap}
              showTrimGuide={false}
            />
          </div>
        ),
        back: backPage ? (
          <div data-bv-bleed className="h-full w-full overflow-hidden bg-white">
            <PagePreview
              page={backPage}
              chapter={backChapter}
              meta={meta}
              photos={photoMap}
              showTrimGuide={false}
            />
          </div>
        ) : (
          <PageShell>
            <div className="m-auto text-sm text-ink-faint">End of their story</div>
          </PageShell>
        ),
      });
    }
  } else if (phase === "album" || phase === "configure" || phase === "processing") {
    // Page 1: left = cover.back (Found/…), right = this front (Meta/…).
    sheets.push({
      id: "funnel-right",
      kind: "soft",
      front: <PageShell>{right}</PageShell>,
      back: (
        <PageShell>
          <p className="m-auto max-w-[24ch] text-center text-sm text-ink-soft">
            Turn the page to continue their book.
          </p>
        </PageShell>
      ),
    });
  } else {
    // Idle open: CTA + upload on the RIGHT page only; left stays empty.
    sheets.push({
      id: "funnel-right",
      kind: "soft",
      front: (
        <PageShell>
          <div className="flex h-full flex-col">
            <div className="mb-4">
              <p className="font-cover text-xl font-semibold leading-snug text-ink sm:text-2xl">
                Drop in their album
              </p>
              <p className="mt-2 text-sm leading-5 text-ink-soft">
                We&rsquo;ll find the chapters on your device — then shape a hardcover
                you can hold.
              </p>
            </div>
            <div className="min-h-0 flex-1">{right}</div>
          </div>
        </PageShell>
      ),
      back: <PageShell>{null}</PageShell>,
    });
  }

  sheets.push({
    id: "back-cover",
    kind: "hard",
    front: <BackCoverArt />,
    back: <div className="h-full w-full bg-memory-blue" />,
  });

  void progress;
  void summary;
  void setMeta;
  void setChapterCount;
  void onMetaContinue;
  void onConfirmSize;
  void onBackToAlbum;
  void onStartOver;
  void dragOver;
  void setDragOver;
  void onFiles;
  void onCancel;
  void chapterCount;
  void sceneReading;

  return sheets;
}

function PageShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-full w-full flex-col overflow-auto bg-[#fbfcff]">
      {children}
    </div>
  );
}

function resolveInterior(args: Parameters<typeof buildFunnelSheets>[0]): {
  left: ReactNode;
  right: ReactNode;
} {
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
    onFiles,
    onCancel,
    chapterCount,
    sceneReading,
  } = args;

  if (phase === "processing") {
    return {
      left: (
        <div className="flex h-full flex-col justify-center p-1">
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
        <div className="flex h-full flex-col justify-between p-1">
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
    const size = SizePages({
      chapterCount,
      maxChapters: summary.maxChapters,
      placeablePhotos: summary.placeable,
      onChange: setChapterCount,
      onConfirm: onConfirmSize,
      onBack: onBackToAlbum,
    });
    return { left: size.left, right: size.right };
  }

  return {
    left: (
      <div className="flex h-full flex-col justify-center p-1">
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
        onFiles={onFiles}
        isOver={dragOver}
        onDragState={setDragOver}
        onInteract={() => undefined}
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
    return "Reading their album…";
  }
  if (progress.phase === "deduplicating") return "Finding the keepers…";
  return "Preparing their chapters…";
}
