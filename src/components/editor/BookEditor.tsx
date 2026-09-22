"use client";

import { ArrowLeft, ArrowRight } from "lucide-react";
import { useEffect, useMemo, useState, type DragEvent } from "react";

import { CustomizeStep } from "@/components/editor/CustomizeStep";
import { FinishStep } from "@/components/editor/FinishStep";
import { UploadMediaModal } from "@/components/editor/UploadMediaModal";
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
  onCheckout,
  onRegenerate,
  notice,
  enableVideoMemories = true,
}: {
  onFiles: (files: File[]) => void;
  onStartOver: () => void;
  onCreateStory: () => void;
  onSample: () => void;
  onCheckout: () => void;
  onRegenerate: (chapterId: string) => void;
  notice?: string | null;
  enableVideoMemories?: boolean;
}) {
  const funnelState = useOurTailTalesStore((state) => state.funnelState);
  const photos = useOurTailTalesStore((state) => state.photos);
  const albumVideos = useOurTailTalesStore((state) => state.albumVideos);
  const processingError = useOurTailTalesStore((state) => state.processingError);
  const chapters = useOurTailTalesStore((state) => state.chapters);
  const chapterCount = useOurTailTalesStore((state) => state.chapterCount);
  const confirmBookSize = useOurTailTalesStore((state) => state.confirmBookSize);

  const summary = useMemo(() => summarizeAlbum(photos), [photos]);
  const mediaCount = summary.placeable + albumVideos.length;

  const [dragOver, setDragOver] = useState(false);
  const [dropping, setDropping] = useState(false);
  const [showFinish, setShowFinish] = useState(false);
  const [uploadModalDismissed, setUploadModalDismissed] = useState(false);

  const processing = funnelState === "processing" || dropping;
  // Shown once, the moment someone lands in the editor with nothing uploaded
  // yet — picking files (or dropping them) flips funnelState away from
  // "idle" on its own, so this closes itself without extra wiring.
  const showUploadModal =
    funnelState === "idle" && mediaCount === 0 && !uploadModalDismissed;
  const readyCount =
    funnelState === "processing"
      ? photos.filter((photo) => photo.usable).length
      : summary.placeable;

  // Skip the old "upload → tell us about them → choose chapters" onboarding
  // pages: build the book skeleton itself as soon as there's enough media,
  // so customers land straight in the editor. Runs once — later uploads just
  // add to the photo pool for swapping in, they never reset written pages.
  useEffect(() => {
    if (chapters.length > 0) return;
    if (funnelState === "processing") return;
    if (mediaCount < MIN_PHOTOS_FOR_BOOK) return;
    confirmBookSize();
    track("book_size_confirmed", {
      chapters: chapterCount,
      price: bookSpec(chapterCount).price,
    });
  }, [chapters.length, funnelState, mediaCount, confirmBookSize, chapterCount]);

  const canOrder = funnelState === "editing" || funnelState === "exporting";

  const handleDragEnter = (event: DragEvent<HTMLElement>): void => {
    event.preventDefault();
    setDragOver(true);
  };

  const handleDragOver = (event: DragEvent<HTMLElement>): void => {
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

  return (
    <div className="book-editor-shell book-editor-field">
      <section
        id="hero-book"
        className={`relative w-full ${
          dragOver ? "ring-4 ring-inset ring-periwinkle/70" : ""
        }`}
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {showUploadModal ? (
          <UploadMediaModal
            onFiles={onFiles}
            processing={processing}
            onClose={() => setUploadModalDismissed(true)}
          />
        ) : null}

        <div className="relative z-10 mx-auto w-full max-w-[100rem] px-5 py-8 sm:px-8 sm:py-10 lg:pl-8 lg:pr-14">
          {showFinish ? (
            <div className="space-y-4">
              <button
                type="button"
                onClick={() => setShowFinish(false)}
                className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-page-line bg-white px-4 py-2.5 text-sm font-semibold text-page-ink shadow-sm transition-colors hover:border-periwinkle hover:text-periwinkle-deep"
              >
                <ArrowLeft aria-hidden className="h-4 w-4" strokeWidth={2.25} />
                Back to editing
              </button>
              <FinishStep onSample={onSample} onCheckout={onCheckout} notice={notice} />
            </div>
          ) : (
            <div className="min-w-0">
              <div className="mb-4 flex justify-end">
                <button
                  type="button"
                  onClick={onStartOver}
                  className="text-xs text-page-ink-soft underline decoration-page-line underline-offset-4 hover:text-periwinkle-deep"
                >
                  Start over with a different album
                </button>
              </div>

              <CustomizeStep
                onCreateStory={onCreateStory}
                onRegenerate={onRegenerate}
                onFiles={onFiles}
                processing={processing}
                readyCount={readyCount}
                videoCount={albumVideos.length}
                enableVideoMemories={enableVideoMemories}
              />

              {chapters.length > 0 ? (
                <div className="mt-6 flex justify-end">
                  <button
                    type="button"
                    onClick={() => setShowFinish(true)}
                    disabled={!canOrder}
                    className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-periwinkle px-6 py-3 text-base font-semibold text-white shadow-lift transition-colors hover:bg-periwinkle-deep disabled:cursor-not-allowed disabled:bg-page-ink/25 disabled:shadow-none"
                  >
                    PDF & order
                    <ArrowRight aria-hidden className="h-5 w-5" strokeWidth={2.25} />
                  </button>
                </div>
              ) : null}
            </div>
          )}
        </div>

        {processingError ? (
          <p
            role="alert"
            className="relative z-10 px-5 pb-2 text-center text-sm text-periwinkle-deep sm:px-8 lg:pl-8 lg:pr-14"
          >
            {processingError}
          </p>
        ) : null}
      </section>
    </div>
  );
}
