"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { AlbumDropzone } from "@/components/AlbumDropzone";
import { AlbumSummaryStep } from "@/components/AlbumSummaryStep";
import { BookPreview } from "@/components/BookPreview";
import { BookSizeSlider } from "@/components/BookSizeSlider";
import { ChapterEditor } from "@/components/ChapterEditor";
import { EmailSampleModal } from "@/components/EmailSampleModal";
import { KeepTabBanner } from "@/components/KeepTabBanner";
import { ProcessingProgress } from "@/components/ProcessingProgress";
import { track } from "@/lib/analytics";
import { possessivePetName } from "@/lib/book/pagination";
import { renderSamplePdf, sampleFileName } from "@/lib/book/sample-pdf";
import { startIngestion, type Ingestion } from "@/lib/photo/process";
import { bookSpec, formatUsd } from "@/lib/pricing";
import { generateChapterStory } from "@/lib/story/client";
import { prepareOrder } from "@/lib/order/prepare";
import {
  photoMapOf,
  selectHasUnsavedWork,
  summarizeAlbum,
  useOurTailTalesStore,
} from "@/store/useOurTailTalesStore";

/** Chapters written at once. Keeps the AI endpoint from being hammered. */
const STORY_CONCURRENCY = 2;

export function Funnel() {
  const router = useRouter();
  const store = useOurTailTalesStore();
  const hasWork = useOurTailTalesStore(selectHasUnsavedWork);

  // Derived from `photos` rather than subscribed, so each render doesn't produce
  // a new object identity and re-trigger the store.
  const summary = useMemo(() => summarizeAlbum(store.photos), [store.photos]);
  const photos = useMemo(() => photoMapOf(store.photos), [store.photos]);

  const ingestion = useRef<Ingestion | null>(null);
  const [sampleOpen, setSampleOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    track("landing_view");
  }, []);

  const handleFiles = useCallback(
    (files: File[]) => {
      store.startProcessing(files.length);
      track("album_selected", { count: files.length });

      ingestion.current = startIngestion(files, {
        onBatch: (batch) => store.addProcessedPhotos(batch),
        onFailures: (count) => store.noteFailures(count),
        onDone: () => {
          store.setProgressPhase("deduplicating");
          store.finishProcessing();
          track("processing_complete", { count: files.length });
        },
        onError: (message) => store.failProcessing(message),
      });
    },
    [store],
  );

  const runStories = useCallback(
    async (chapterIds: string[]) => {
      const state = useOurTailTalesStore.getState();
      const photoMap = photoMapOf(state.photos);
      const context = {
        petName: state.meta.petName,
        birthYear: state.meta.birthYear,
        deathYear: state.meta.deathYear,
      };

      const queue = [...chapterIds];
      const worker = async (): Promise<void> => {
        for (;;) {
          const chapterId = queue.shift();
          if (!chapterId) return;

          const chapter = useOurTailTalesStore
            .getState()
            .chapters.find((entry) => entry.id === chapterId);
          if (!chapter) continue;

          const actions = useOurTailTalesStore.getState();
          actions.setChapterAiStatus(chapterId, "pending");
          try {
            const { story, places } = await generateChapterStory(
              chapter,
              photoMap,
              context,
            );
            actions.setChapterPlaces(chapterId, places);
            actions.applyChapterStory(chapterId, story);
          } catch (error) {
            actions.setChapterAiStatus(
              chapterId,
              "error",
              error instanceof Error ? error.message : "Story generation failed.",
            );
          }
        }
      };

      await Promise.all(
        Array.from({ length: Math.min(STORY_CONCURRENCY, queue.length) }, worker),
      );
    },
    [],
  );

  const handleCreateStory = useCallback(async () => {
    const state = useOurTailTalesStore.getState();
    state.beginStoryGeneration();
    await runStories(state.chapters.map((chapter) => chapter.id));
    useOurTailTalesStore.getState().finishStoryGeneration();
    track("story_generated", {
      chapters: useOurTailTalesStore.getState().chapters.length,
    });
  }, [runStories]);

  const handleSample = useCallback(
    async (email: string) => {
      const state = useOurTailTalesStore.getState();
      state.setLeadEmail(email);

      await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          petName: state.meta.petName,
          chapterCount: state.chapterCount,
          photoCount: state.photos.length,
        }),
      }).catch(() => {
        // Never block the sample on lead capture.
      });

      const blob = await renderSamplePdf({
        pages: state.pages,
        chapters: state.chapters,
        meta: state.meta,
        photos: photoMapOf(state.photos),
      });

      downloadBlob(blob, sampleFileName(state.meta.petName));
      track("sample_email_submitted", { chapters: state.chapterCount });
    },
    [],
  );

  const handleCheckout = useCallback(async () => {
    setNotice(null);
    const state = useOurTailTalesStore.getState();

    try {
      const { orderId } = await prepareOrder({
        meta: state.meta,
        chapters: state.chapters,
        pages: state.pages,
        chapterCount: state.chapterCount,
        photos: photoMapOf(state.photos),
        email: state.leadEmail,
        onStatus: (message) => state.setExporting(message),
      });

      track("checkout_started", { chapters: state.chapterCount });
      router.push(`/checkout?order=${orderId}`);
    } catch (error) {
      useOurTailTalesStore.getState().setExporting(null);
      useOurTailTalesStore.getState().goToEditing();
      setNotice(
        error instanceof Error
          ? error.message
          : "Your book could not be prepared for printing.",
      );
    }
  }, [router]);

  const spec = useMemo(() => bookSpec(store.chapterCount), [store.chapterCount]);

  return (
    <>
      <KeepTabBanner active={hasWork} />

      <main className="mx-auto w-full max-w-5xl flex-1 px-5 pb-24 pt-10 sm:pt-16">
        <Header />

        {store.funnelState === "idle" && (
          <section className="mt-10 space-y-8">
            <div className="max-w-2xl">
              <h1 className="text-balance-tight font-display text-4xl leading-[1.1] text-ink sm:text-6xl">
                Turn their camera roll into the story of their life.
              </h1>
              <p className="mt-5 text-lg leading-relaxed text-ink-soft">
                Drop in your pet&rsquo;s photo album. We&rsquo;ll organize the
                years, build the chapters, and create a hardcover book you can
                keep forever.
              </p>
            </div>

            <AlbumDropzone onFiles={handleFiles} />

            {store.processingError && (
              <p role="alert" className="text-sm text-tail-deep">
                {store.processingError}
              </p>
            )}

            <HowItWorks />
          </section>
        )}

        {store.funnelState === "processing" && (
          <div className="mt-10">
            <ProcessingProgress
              progress={store.progress}
              onCancel={() => {
                ingestion.current?.cancel();
                store.cancelProcessing();
              }}
            />
          </div>
        )}

        {store.funnelState === "album_ready" && (
          <div className="mt-10">
            <AlbumSummaryStep
              summary={summary}
              meta={store.meta}
              onMetaChange={store.setMeta}
              onContinue={store.goToConfigure}
              onStartOver={() => {
                ingestion.current?.cancel();
                store.reset();
              }}
            />
          </div>
        )}

        {store.funnelState === "configure" && (
          <div className="mt-10">
            <BookSizeSlider
              chapterCount={store.chapterCount}
              maxChapters={summary.maxChapters}
              placeablePhotos={summary.placeable}
              onChange={store.setChapterCount}
              onConfirm={() => {
                store.confirmBookSize();
                track("book_size_confirmed", {
                  chapters: store.chapterCount,
                  price: spec.price,
                });
              }}
              onBack={() => useOurTailTalesStore.setState({ funnelState: "album_ready" })}
            />
          </div>
        )}

        {(store.funnelState === "organizing" ||
          store.funnelState === "ai_generating" ||
          store.funnelState === "editing" ||
          store.funnelState === "exporting") && (
          <div className="mt-10 space-y-8">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <h2 className="font-display text-3xl text-ink">
                  {possessivePetName(store.meta.petName)} story
                </h2>
                <p className="mt-1 text-sm text-ink-soft">
                  {spec.chapterCount} chapters · {spec.storyPages} story pages +{" "}
                  {spec.fixedPages} complimentary pages ·{" "}
                  {formatUsd(spec.price)}
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                {store.funnelState === "organizing" && (
                  <button
                    type="button"
                    onClick={() => void handleCreateStory()}
                    className="rounded-full bg-tail px-6 py-2.5 text-sm font-medium text-paper shadow-lift transition-colors hover:bg-tail-deep"
                  >
                    Create My Story
                  </button>
                )}

                {store.funnelState === "editing" && (
                  <>
                    <button
                      type="button"
                      onClick={() => setSampleOpen(true)}
                      className="rounded-full border border-line px-5 py-2.5 text-sm text-ink-soft transition-colors hover:border-tail hover:text-tail-deep"
                    >
                      See 5 pages free
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleCheckout()}
                      className="rounded-full bg-tail px-6 py-2.5 text-sm font-medium text-paper shadow-lift transition-colors hover:bg-tail-deep"
                    >
                      Order this book — {formatUsd(spec.price)}
                    </button>
                  </>
                )}
              </div>
            </div>

            {store.funnelState === "organizing" && <PrivacyNote />}

            {store.funnelState === "ai_generating" && (
              <StoryProgress
                total={store.chapters.length}
                done={
                  store.chapters.filter((chapter) => chapter.aiStatus === "done")
                    .length
                }
              />
            )}

            {store.funnelState === "exporting" && (
              <p
                role="status"
                className="rounded-xl border border-tail/30 bg-tail-wash/40 px-4 py-3 text-sm text-tail-deep"
              >
                {store.exportMessage ?? "Preparing your book…"}
              </p>
            )}

            {notice && (
              <p role="alert" className="text-sm text-tail-deep">
                {notice}
              </p>
            )}

            <BookPreview
              pages={store.pages}
              chapters={store.chapters}
              meta={store.meta}
              photos={photos}
            />

            {(store.funnelState === "editing" ||
              store.funnelState === "organizing") && (
              <ChapterEditor
                chapters={store.chapters}
                photos={photos}
                coverPhotoId={store.meta.coverPhotoId}
                onTextChange={store.updateChapterText}
                onSwap={store.swapChapterPhoto}
                onReorder={store.reorderChapterPhoto}
                onSetCover={store.setCoverPhoto}
                onRegenerate={(chapterId) => void runStories([chapterId])}
              />
            )}
          </div>
        )}
      </main>

      {sampleOpen && (
        <EmailSampleModal
          onClose={() => setSampleOpen(false)}
          onSubmit={handleSample}
          initialEmail={store.leadEmail}
        />
      )}
    </>
  );
}

function Header() {
  return (
    <header className="flex items-baseline justify-between">
      <p className="font-display text-xl tracking-tight text-ink">
        ourTailTales
      </p>
      <p className="text-xs uppercase tracking-[0.2em] text-ink-faint">
        Hardcover pet life stories
      </p>
    </header>
  );
}

function HowItWorks() {
  const steps = [
    {
      title: "Drop in the album",
      body: "Hundreds or thousands of photos. Everything is read on your device — nothing is uploaded to look through it.",
    },
    {
      title: "We find the chapters",
      body: "Dates and places become a timeline, duplicates step aside, and the best photos rise to the top.",
    },
    {
      title: "Keep it forever",
      body: "An 8.5 × 8.5 inch hardcover, printed and bound on demand, from $49.99.",
    },
  ];

  return (
    <div className="grid gap-6 border-t border-line pt-8 sm:grid-cols-3">
      {steps.map((step, index) => (
        <div key={step.title}>
          <p className="font-display text-sm text-tail">0{index + 1}</p>
          <h2 className="mt-1.5 font-display text-lg text-ink">{step.title}</h2>
          <p className="mt-1.5 text-sm leading-6 text-ink-soft">{step.body}</p>
        </div>
      ))}
    </div>
  );
}

function PrivacyNote() {
  return (
    <div className="rounded-xl border border-moss/25 bg-moss-wash/60 px-4 py-3 text-sm leading-6 text-ink-soft">
      <strong className="font-medium text-ink">Before you continue:</strong> when
      you choose <em>Create My Story</em>, we send a few small preview images from
      each chapter — three to five per chapter — along with dates and
      city-level places, so the chapter introductions can be written. Your full
      album is never uploaded, exact coordinates are never sent, and those preview
      images aren&rsquo;t stored anywhere afterwards.
    </div>
  );
}

function StoryProgress({ total, done }: { total: number; done: number }) {
  return (
    <div
      role="status"
      className="rounded-xl border border-line bg-paper-deep/50 px-4 py-3 text-sm text-ink-soft"
    >
      Writing your chapters — {done} of {total} done. You&rsquo;ll be able to edit
      every word.
    </div>
  );
}

function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
