"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { BrandMark } from "@/components/BrandMark";
import { EmailSampleModal } from "@/components/EmailSampleModal";
import { BookPreviewDialog } from "@/components/book-viewer/BookPreviewDialog";
import { BookEditor } from "@/components/editor/BookEditor";
import { KeepTabBanner } from "@/components/KeepTabBanner";
import { Faq } from "@/components/landing/Faq";
import { Footer } from "@/components/landing/Footer";
import { LandingCta } from "@/components/landing/LandingCta";
import { LandingHero } from "@/components/landing/LandingHero";
import { ProductListing } from "@/components/landing/ProductListing";
import { captureClientException, identifyLead, track } from "@/lib/analytics";
import { renderSamplePdf, sampleFileName } from "@/lib/book/sample-pdf";
import {
  partitionMedia,
  startIngestion,
  type Ingestion,
} from "@/lib/photo/process";
import { makeVideoPreview } from "@/lib/photo/videoPreview";
import { generateChapterStory } from "@/lib/story/client";
import { prepareOrder } from "@/lib/order/prepare";
import {
  fetchVideoLibrary,
  readVideoDurationMs,
  uploadVideoMemory,
} from "@/lib/video-memory/client";
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

  const ingestion = useRef<Ingestion | null>(null);
  const [sampleOpen, setSampleOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
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
      const { images, videos } = partitionMedia(files);
      if (images.length === 0 && videos.length === 0) return;

      track("album_selected", { count: images.length + videos.length });

      if (images.length > 0) {
        store.startProcessing(images.length);
        ingestion.current = startIngestion(images, {
          onBatch: (batch) => store.addProcessedPhotos(batch),
          onFailures: (count) => store.noteFailures(count),
          onDone: () => {
            store.setProgressPhase("deduplicating");
            store.finishProcessing();
            track("processing_complete", { count: images.length });
          },
          onError: (message) => store.failProcessing(message),
        });
      }

      if (videos.length > 0) {
        void (async () => {
          const added: {
            id: string;
            posterUrl: string;
            previewUrl: string;
            fileName: string;
          }[] = [];
          for (const file of videos) {
            const id = crypto.randomUUID();
            try {
              const preview = await makeVideoPreview(id, file);
              added.push({ id, fileName: file.name, ...preview });
            } catch {
              // Skip a video we cannot preview; still try to store it if we can.
            }
          }
          if (added.length > 0) store.addAlbumVideos(added);

          const draft =
            store.draftId && store.draftSecret
              ? { draftId: store.draftId, secret: store.draftSecret }
              : null;
          if (!draft) return;
          for (const file of videos) {
            try {
              const durationMs = await readVideoDurationMs(file).catch(
                () => undefined,
              );
              await uploadVideoMemory(draft, file, {
                durationMs,
                title: file.name.replace(/\.[^.]+$/, ""),
              });
            } catch {
              // Preview already sits in the album; the editor can retry upload.
            }
          }
          try {
            const library = await fetchVideoLibrary(draft);
            store.setVideoLibrary(library.assets, library.placements);
          } catch {
            /* editor surfaces a message if the library cannot refresh */
          }
        })();
      }
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
    identifyLead(email);

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
      captureClientException(error);
      useOurTailTalesStore.getState().setExporting(null);
      useOurTailTalesStore.getState().goToEditing();
      setNotice(
        error instanceof Error
          ? error.message
          : "Your book could not be prepared for printing.",
      );
    }
  }, [router]);

  return (
    <>
      <KeepTabBanner active={hasWork} />

      <main className="w-full flex-1 pb-0">
        <LandingHero header={<Header />} />
        <ProductListing />
        <BookEditor
          onFiles={handleFiles}
          onStartOver={() => {
            ingestion.current?.cancel();
            store.reset();
          }}
          onCreateStory={() => void handleCreateStory()}
          onSample={() => setSampleOpen(true)}
          onPreview={() => setPreviewOpen(true)}
          onCheckout={() => void handleCheckout()}
          onRegenerate={(chapterId) => void runStories([chapterId])}
          notice={notice}
        />

        <div className="landing-rest">
          <LandingCta />
          <Faq />
          <Footer />
        </div>
      </main>

      {sampleOpen && (
        <EmailSampleModal
          onClose={() => setSampleOpen(false)}
          onSubmit={handleSample}
          initialEmail={store.leadEmail}
        />
      )}

      {previewOpen && (
        <BookPreviewDialog onClose={() => setPreviewOpen(false)} />
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
