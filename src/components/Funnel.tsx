"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { BrandMark } from "@/components/BrandMark";
import { ChapterEditor } from "@/components/ChapterEditor";
import { EmailSampleModal } from "@/components/EmailSampleModal";
import { FunnelBookHero } from "@/components/book-viewer/FunnelBookHero";
import { KeepTabBanner } from "@/components/KeepTabBanner";
import { track } from "@/lib/analytics";
import { renderSamplePdf, sampleFileName } from "@/lib/book/sample-pdf";
import { startIngestion, type Ingestion } from "@/lib/photo/process";
import { bookSpec } from "@/lib/pricing";
import { generateChapterStory } from "@/lib/story/client";
import { prepareOrder } from "@/lib/order/prepare";
import {
  photoMapOf,
  selectHasUnsavedWork,
  useOurTailTalesStore,
} from "@/store/useOurTailTalesStore";

/** Chapters written at once. Keeps the AI endpoint from being hammered. */
const STORY_CONCURRENCY = 2;

export function Funnel() {
  const router = useRouter();
  const store = useOurTailTalesStore();
  const hasWork = useOurTailTalesStore(selectHasUnsavedWork);
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

  const runStories = useCallback(async (chapterIds: string[]) => {
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
  }, []);

  const handleCreateStory = useCallback(async () => {
    const state = useOurTailTalesStore.getState();
    state.beginStoryGeneration();
    await runStories(state.chapters.map((chapter) => chapter.id));
    useOurTailTalesStore.getState().finishStoryGeneration();
    track("story_generated", {
      chapters: useOurTailTalesStore.getState().chapters.length,
    });
  }, [runStories]);

  const handleSample = useCallback(async (email: string) => {
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
  }, []);

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
  const showEditor =
    store.funnelState === "organizing" || store.funnelState === "editing";

  return (
    <>
      <KeepTabBanner active={hasWork} />

      <main className="mx-auto w-full max-w-[90rem] flex-1 px-5 pb-24 pt-10 sm:pt-16">
        <Header />

        <section className="mt-8 space-y-10 sm:mt-10">
          <FunnelBookHero
            onFiles={handleFiles}
            onCancel={() => {
              ingestion.current?.cancel();
              store.cancelProcessing();
            }}
            onStartOver={() => {
              ingestion.current?.cancel();
              store.reset();
            }}
            onMetaContinue={store.goToConfigure}
            onConfirmSize={() => {
              store.confirmBookSize();
              track("book_size_confirmed", {
                chapters: store.chapterCount,
                price: spec.price,
              });
            }}
            onBackToAlbum={() =>
              useOurTailTalesStore.setState({ funnelState: "album_ready" })
            }
            onCreateStory={() => void handleCreateStory()}
            onSample={() => setSampleOpen(true)}
            onCheckout={() => void handleCheckout()}
            notice={notice}
          />

          {store.funnelState === "idle" && <HowItWorks />}

          {showEditor && (
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
        </section>
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
    <header className="flex items-center justify-between gap-4">
      <BrandMark href="/" size="md" priority />
      <p className="hidden text-xs font-medium tracking-wide text-ink-faint sm:block">
        Their life, in chapters.
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
          <p className="font-display text-sm text-periwinkle">0{index + 1}</p>
          <h2 className="mt-1.5 font-display text-lg text-ink">{step.title}</h2>
          <p className="mt-1.5 text-sm leading-6 text-ink-soft">{step.body}</p>
        </div>
      ))}
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
