"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { BrandMark } from "@/components/BrandMark";
import { ChapterEditor } from "@/components/ChapterEditor";
import { EmailSampleModal } from "@/components/EmailSampleModal";
import { VideoMemoriesPanel } from "@/components/VideoMemoriesPanel";
import { FunnelBookHero } from "@/components/book-viewer/FunnelBookHero";
import { KeepTabBanner } from "@/components/KeepTabBanner";
import { Footer } from "@/components/landing/Footer";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { LandingCta } from "@/components/landing/LandingCta";
import { LandingHero } from "@/components/landing/LandingHero";
import { ProductMockups } from "@/components/landing/ProductMockups";
import { track } from "@/lib/analytics";
import { renderSamplePdf, sampleFileName } from "@/lib/book/sample-pdf";
import { startIngestion, type Ingestion } from "@/lib/photo/process";
import { bookSpec } from "@/lib/pricing";
import { generateChapterStory } from "@/lib/story/client";
import { prepareOrder } from "@/lib/order/prepare";
import { fetchVideoLibrary } from "@/lib/video-memory/client";
import { placedMemoriesReadyForCheckout } from "@/lib/video-memory/checkout-ready";
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
  const hydrateDraft = useOurTailTalesStore((state) => state.hydrateDraft);
  const draftId = useOurTailTalesStore((state) => state.draftId);
  const draftSecret = useOurTailTalesStore((state) => state.draftSecret);
  const setVideoLibrary = useOurTailTalesStore((state) => state.setVideoLibrary);
  const hasWork = useOurTailTalesStore(selectHasUnsavedWork);
  const photos = useMemo(() => photoMapOf(store.photos), [store.photos]);

  const ingestion = useRef<Ingestion | null>(null);
  const [sampleOpen, setSampleOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    track("landing_view");
    hydrateDraft();
  }, [hydrateDraft]);

  useEffect(() => {
    if (!draftId || !draftSecret) return;
    void fetchVideoLibrary({ draftId, secret: draftSecret })
      .then((library) => setVideoLibrary(library.assets, library.placements))
      .catch(() => {
        // Editor panel surfaces a customer message if the library cannot load.
      });
  }, [draftId, draftSecret, setVideoLibrary]);

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
      placements: state.placements,
    });

    downloadBlob(blob, sampleFileName(state.meta.petName));
    track("sample_email_submitted", { chapters: state.chapterCount });
  }, []);

  const handleCheckout = useCallback(async () => {
    setNotice(null);
    const state = useOurTailTalesStore.getState();

    try {
      if (
        state.placements.length > 0 &&
        (!state.draftId || !state.draftSecret)
      ) {
        throw new Error(
          "Your Video Memories could not be saved. Please try again.",
        );
      }
      if (
        !placedMemoriesReadyForCheckout(state.placements, state.videoAssets)
      ) {
        throw new Error(
          "Every placed Video Memory must be ready before checkout. Unused videos can keep preparing.",
        );
      }

      const { orderId } = await prepareOrder({
        meta: state.meta,
        chapters: state.chapters,
        pages: state.pages,
        chapterCount: state.chapterCount,
        photos: photoMapOf(state.photos),
        email: state.leadEmail,
        draftId: state.draftId,
        draftSecret: state.draftSecret,
        placements: state.placements,
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

  const idle = store.funnelState === "idle";

  const book = (
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
  );

  return (
    <>
      <KeepTabBanner active={hasWork} />

      <main className="w-full flex-1 pb-0">
        <div className={`mx-auto w-full max-w-[90rem] px-5 pt-10 sm:pt-14${idle ? "" : " pb-24"}`}>
          <Header />
          {!idle && <div className="mt-8 sm:mt-10">{book}</div>}
        </div>

        {idle && (
          <>
            <div className="mt-8 sm:mt-10">
              <LandingHero />
            </div>
            <section className="mx-auto max-w-[90rem] px-5 py-16 sm:py-20">
              {book}
            </section>
            <HowItWorks />
            <ProductMockups />
            <LandingCta />
          </>
        )}

        {showEditor && (
          <div className="mx-auto mt-10 w-full max-w-[90rem] px-5 pb-24">
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
            <div className="mt-6">
              <VideoMemoriesPanel pages={store.pages} />
            </div>
          </div>
        )}
      </main>

      {idle && <Footer />}

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
    </header>
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
