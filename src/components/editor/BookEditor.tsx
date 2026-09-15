"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type DragEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";

import { FunnelBookHero } from "@/components/book-viewer/FunnelBookHero";
import { albumTilesFrom } from "@/components/editor/albumTiles";
import { CustomizeStep } from "@/components/editor/CustomizeStep";
import { EditorStepNav } from "@/components/editor/EditorStepNav";
import { FinishStep } from "@/components/editor/FinishStep";
import { MediaUploadStep } from "@/components/editor/MediaUploadStep";
import {
  EDITOR_STEP_COUNT,
  farthestStep,
  stepFromFunnelState,
} from "@/components/editor/steps";
import { MetaPage, SizePanel } from "@/components/hero/funnelSpreads";
import { BookEditorIntro } from "@/components/landing/BookEditorIntro";
import { filesFromDataTransfer } from "@/lib/photo/process";
import { bookSpec, MIN_PHOTOS_FOR_BOOK } from "@/lib/pricing";
import { track } from "@/lib/analytics";
import {
  summarizeAlbum,
  useOurTailTalesStore,
} from "@/store/useOurTailTalesStore";

export function BookEditor({
  onFiles,
  onStartOver,
  onCreateStory,
  onSample,
  onPreview,
  onCheckout,
  onRegenerate,
  notice,
}: {
  onFiles: (files: File[]) => void;
  onStartOver: () => void;
  onCreateStory: () => void;
  onSample: () => void;
  onPreview: () => void;
  onCheckout: () => void;
  onRegenerate: (chapterId: string) => void;
  notice?: string | null;
}) {
  const funnelState = useOurTailTalesStore((state) => state.funnelState);
  const photos = useOurTailTalesStore((state) => state.photos);
  const albumVideos = useOurTailTalesStore((state) => state.albumVideos);
  const processingError = useOurTailTalesStore((state) => state.processingError);
  const meta = useOurTailTalesStore((state) => state.meta);
  const chapterCount = useOurTailTalesStore((state) => state.chapterCount);
  const setMeta = useOurTailTalesStore((state) => state.setMeta);
  const setChapterCount = useOurTailTalesStore((state) => state.setChapterCount);
  const goToConfigure = useOurTailTalesStore((state) => state.goToConfigure);
  const confirmBookSize = useOurTailTalesStore((state) => state.confirmBookSize);
  const removeAlbumPhoto = useOurTailTalesStore((state) => state.removeAlbumPhoto);
  const removeAlbumVideo = useOurTailTalesStore((state) => state.removeAlbumVideo);

  const summary = useMemo(() => summarizeAlbum(photos), [photos]);
  const tiles = useMemo(
    () => albumTilesFrom(photos, albumVideos),
    [photos, albumVideos],
  );
  const spec = useMemo(() => bookSpec(chapterCount), [chapterCount]);
  const mediaCount = summary.placeable + albumVideos.length;
  const canLeaveUpload = mediaCount >= MIN_PHOTOS_FOR_BOOK;
  const canMetaContinue =
    meta.petName.trim().length > 0 && summary.placeable > 0;
  const farthest = farthestStep(funnelState, canLeaveUpload);

  const [step, setStep] = useState(() => stepFromFunnelState(funnelState));
  const [dragOver, setDragOver] = useState(false);
  const [dropping, setDropping] = useState(false);
  const [swipe, setSwipe] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const mapped = stepFromFunnelState(funnelState);
    setStep((current) => Math.min(current, Math.max(farthest, mapped)));
  }, [funnelState, farthest]);

  const visibleStep = step;
  const showBook = visibleStep > 0;
  const processing = funnelState === "processing" || dropping;
  const readyCount =
    funnelState === "processing"
      ? photos.filter((photo) => photo.usable).length
      : summary.placeable;

  const goTo = useCallback(
    (next: number) => {
      const target = Math.max(0, Math.min(next, farthest));
      setStep(target);
    },
    [farthest],
  );

  const handleNext = useCallback(() => {
    if (visibleStep === 0 && canLeaveUpload) {
      setStep(1);
      return;
    }
    if (visibleStep === 1 && canMetaContinue) {
      if (farthest < 2) goToConfigure();
      setStep(2);
      return;
    }
    if (visibleStep === 2) {
      if (farthest < 3) {
        confirmBookSize();
        track("book_size_confirmed", {
          chapters: chapterCount,
          price: spec.price,
        });
      }
      setStep(3);
      return;
    }
    if (visibleStep === 3 && funnelState === "editing") {
      setStep(4);
    }
  }, [
    canLeaveUpload,
    canMetaContinue,
    chapterCount,
    confirmBookSize,
    farthest,
    funnelState,
    goToConfigure,
    spec.price,
    visibleStep,
  ]);

  const canNext =
    (visibleStep === 0 && canLeaveUpload) ||
    (visibleStep === 1 && canMetaContinue) ||
    visibleStep === 2 ||
    (visibleStep === 3 && funnelState === "editing");

  const nextLabel =
    visibleStep === 2
      ? "Continue with these chapters"
      : visibleStep === 3
        ? "PDF & order"
        : "Next";

  const acceptUploads = visibleStep === 0;

  const handleDragEnter = (event: DragEvent<HTMLElement>): void => {
    if (!acceptUploads) return;
    event.preventDefault();
    setDragOver(true);
  };

  const handleDragOver = (event: DragEvent<HTMLElement>): void => {
    if (!acceptUploads) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    setDragOver(true);
  };

  const handleDragLeave = (event: DragEvent<HTMLElement>): void => {
    const next = event.relatedTarget;
    if (next instanceof Node && event.currentTarget.contains(next)) return;
    setDragOver(false);
  };

  const handleDrop = (event: DragEvent<HTMLElement>): void => {
    if (!acceptUploads) return;
    event.preventDefault();
    event.stopPropagation();
    setDragOver(false);
    void (async () => {
      setDropping(true);
      try {
        const files = await filesFromDataTransfer(event.dataTransfer);
        if (files.length > 0) onFiles(files);
      } finally {
        setDropping(false);
      }
    })();
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>): void => {
    if (event.target instanceof Element) {
      if (
        event.target.closest(
          "button, a, input, textarea, select, label, [role='button']",
        )
      ) {
        return;
      }
    }
    setSwipe({ x: event.clientX, y: event.clientY });
  };

  const handlePointerUp = (event: ReactPointerEvent<HTMLDivElement>): void => {
    if (!swipe) return;
    const dx = event.clientX - swipe.x;
    const dy = event.clientY - swipe.y;
    setSwipe(null);
    if (Math.abs(dx) < 64 || Math.abs(dx) < Math.abs(dy)) return;
    if (dx < 0 && canNext) handleNext();
    else if (dx > 0 && visibleStep > 0) goTo(visibleStep - 1);
  };

  return (
    <>
      <BookEditorIntro
        activeIndex={visibleStep}
        farthestIndex={farthest}
        onSelect={goTo}
      />
      <section
        id="hero-book"
        className={`book-editor-field relative w-full ${
          dragOver ? "ring-4 ring-inset ring-periwinkle/70" : ""
        }`}
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <div
          className={`relative z-10 mx-auto flex w-full max-w-[90rem] ${
            showBook
              ? "flex-col gap-6 px-5 pt-4 sm:px-8 lg:flex-row lg:items-start lg:gap-10"
              : ""
          }`}
          onPointerDown={handlePointerDown}
          onPointerUp={handlePointerUp}
          onPointerCancel={() => setSwipe(null)}
        >
          {showBook ? (
            <div className="shrink-0 lg:sticky lg:top-8">
              <FunnelBookHero
                docked
                mode={visibleStep === 1 ? "meta" : "closed"}
              />
            </div>
          ) : null}

          <div
            className={`min-w-0 ${
              showBook ? "flex-1 pb-4 pt-2 lg:min-h-[min(58vh,32rem)]" : "w-full"
            }`}
            aria-roledescription="carousel"
            aria-label="Book editor steps"
          >
            <div
              role="group"
              aria-label={`Step ${visibleStep + 1} of ${EDITOR_STEP_COUNT}`}
            >
                {visibleStep === 0 && (
                  <MediaUploadStep
                    tiles={tiles}
                    readyCount={readyCount}
                    processing={processing}
                    dragOver={dragOver}
                    canNext={canLeaveUpload}
                    onFiles={onFiles}
                    onNext={handleNext}
                    onRemove={(id, kind) => {
                      if (kind === "video") removeAlbumVideo(id);
                      else removeAlbumPhoto(id);
                    }}
                  />
                )}
                {visibleStep === 1 && (
                  <div className="rounded-2xl border border-page-line bg-white/85 p-5 shadow-lift sm:p-7">
                    <MetaPage
                      summary={summary}
                      meta={meta}
                      onMetaChange={setMeta}
                      onContinue={handleNext}
                      onStartOver={() => {
                        setStep(0);
                        onStartOver();
                      }}
                      showNav={false}
                    />
                  </div>
                )}
                {visibleStep === 2 && (
                  <div className="rounded-2xl border border-page-line bg-white/85 p-5 shadow-lift sm:p-7">
                    <SizePanel
                      chapterCount={chapterCount}
                      maxChapters={summary.maxChapters}
                      placeablePhotos={summary.placeable}
                      onChange={setChapterCount}
                      onConfirm={handleNext}
                      showNav={false}
                    />
                  </div>
                )}
                {visibleStep === 3 && (
                  <CustomizeStep
                    onCreateStory={onCreateStory}
                    onPreview={onPreview}
                    onRegenerate={onRegenerate}
                  />
                )}
                {visibleStep === 4 && (
                  <div className="rounded-2xl border border-page-line bg-white/85 p-5 shadow-lift sm:p-7">
                    <FinishStep
                      onSample={onSample}
                      onPreview={onPreview}
                      onCheckout={onCheckout}
                      notice={notice}
                    />
                  </div>
                )}
            </div>
          </div>
        </div>

        {processingError && visibleStep === 0 ? (
          <p
            role="alert"
            className="relative z-10 px-5 pb-2 text-center text-sm text-periwinkle-deep sm:px-8"
          >
            {processingError}
          </p>
        ) : null}

        {visibleStep > 0 ? (
          <EditorStepNav
            canPrev={visibleStep > 0}
            canNext={canNext}
            showNext={visibleStep < 4}
            nextLabel={nextLabel}
            onPrev={() => goTo(visibleStep - 1)}
            onNext={handleNext}
          />
        ) : null}
      </section>
    </>
  );
}
