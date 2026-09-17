"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { EmailSampleModal } from "@/components/EmailSampleModal";
import { BookPreviewDialog } from "@/components/book-viewer/BookPreviewDialog";
import {
  BookAuthGate,
  type ProtectedBookAction,
} from "@/components/auth/BookAuthGate";
import { BookGenerationStage } from "@/components/create/BookGenerationStage";
import { BookReadyStage } from "@/components/create/BookReadyStage";
import { QuickUploadStage } from "@/components/create/QuickUploadStage";
import { BookEditor } from "@/components/editor/BookEditor";
import { KeepTabBanner } from "@/components/KeepTabBanner";
import { SiteHeader } from "@/components/SiteHeader";
import { captureClientException, identifyLead, track } from "@/lib/analytics";
import {
  renderFreePreviewPdf,
  renderSamplePdf,
  sampleFileName,
} from "@/lib/book/sample-pdf";
import {
  partitionMedia,
  startIngestion,
  type Ingestion,
} from "@/lib/photo/process";
import { makeVideoPreview } from "@/lib/photo/videoPreview";
import { persistLocalDraft } from "@/lib/drafts/local";
import { saveBookProject } from "@/lib/books/cloud";
import {
  authConfigured,
  createAuthBrowserClient,
} from "@/lib/supabase/auth-browser";
import { generateChapterStory } from "@/lib/story/client";
import { prepareOrder } from "@/lib/order/prepare";
import { placedMemoriesReadyForCheckout } from "@/lib/video-memory/checkout-ready";
import {
  photoMapOf,
  selectHasUnsavedWork,
  useOurTailTalesStore,
} from "@/store/useOurTailTalesStore";

/** Chapters written at once. Keeps the AI endpoint from being hammered. */
const STORY_CONCURRENCY = 2;

export function Funnel({ embedded = false }: { embedded?: boolean }) {
  const router = useRouter();
  const store = useOurTailTalesStore();
  const hasWork = useOurTailTalesStore(selectHasUnsavedWork);
  const funnelState = useOurTailTalesStore((state) => state.funnelState);

  const ingestion = useRef<Ingestion | null>(null);
  const [sampleOpen, setSampleOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [localReady, setLocalReady] = useState(false);
  const [previewPreparing, setPreviewPreparing] = useState(false);
  const [authAction, setAuthAction] = useState<ProtectedBookAction | null>(null);
  const [cloudSaving, setCloudSaving] = useState(false);

  useEffect(() => {
    track("create_page_viewed");
    void useOurTailTalesStore
      .getState()
      .restoreLocalBook()
      .finally(() => setLocalReady(true));
  }, []);

  const saveAndPerformAction = useCallback(
    async (action: ProtectedBookAction) => {
      setCloudSaving(true);
      setNotice(null);
      try {
        const bookId = await saveBookProject(useOurTailTalesStore.getState());
        track("free_book_saved", { action });
        router.push(`/book/${bookId}${action === "pdf" ? "?view=pdf" : ""}`);
      } catch (error) {
        captureClientException(error);
        setNotice(
          error instanceof Error
            ? error.message
            : "Your book could not be saved. Please try again.",
        );
      } finally {
        setCloudSaving(false);
      }
    },
    [router],
  );

  useEffect(() => {
    if (!localReady || !store.freePreviewReady || !authConfigured()) return;
    const pending = sessionStorage.getItem(
      "ourtailtales.pendingBookAction",
    ) as ProtectedBookAction | null;
    if (pending !== "preview" && pending !== "pdf") return;
    void createAuthBrowserClient()
      .auth.getUser()
      .then(({ data }) => {
        if (!data.user) return;
        sessionStorage.removeItem("ourtailtales.pendingBookAction");
        void saveAndPerformAction(pending);
      });
  }, [localReady, saveAndPerformAction, store.freePreviewReady]);

  const requestProtectedAction = useCallback(
    async (action: ProtectedBookAction) => {
      if (authConfigured()) {
        const { data } = await createAuthBrowserClient().auth.getUser();
        if (data.user) {
          await saveAndPerformAction(action);
          return;
        }
      }
      sessionStorage.setItem("ourtailtales.pendingBookAction", action);
      track("auth_gate_viewed", { action });
      setAuthAction(action);
    },
    [saveAndPerformAction],
  );

  const handleFiles = useCallback(
    (files: File[]) => {
      const { images, videos } = partitionMedia(files);
      if (images.length === 0 && videos.length === 0) return;

      track("album_selected", { count: images.length + videos.length });
      store.startProcessing(images.length + videos.length);
      track("album_processing_started", {
        count: images.length + videos.length,
      });

      const photosDone = new Promise<void>((resolve) => {
        if (images.length === 0) {
          resolve();
          return;
        }
        ingestion.current = startIngestion(images, {
          onBatch: (batch) => store.addProcessedPhotos(batch),
          onFailures: (count) => store.noteFailures(count),
          onDone: resolve,
          onError: (message) => {
            store.failProcessing(message);
            resolve();
          },
        });
      });

      const videosDone = (async () => {
        for (const file of videos) {
          const id = crypto.randomUUID();
          try {
            const preview = await makeVideoPreview(id, file);
            store.addAlbumVideos([
              { id, fileName: file.name, ...preview },
            ]);
            store.advanceProcessing();
          } catch {
            store.noteFailures(1);
          }
        }
      })();

      void Promise.all([photosDone, videosDone]).then(() => {
        store.setProgressPhase("deduplicating");
        store.finishProcessing();
        void persistLocalDraft(useOurTailTalesStore.getState()).catch(() => {
          setNotice(
            "This browser could not save the album for later. Keep this tab open while creating your book.",
          );
        });
        track("album_processing_completed", {
          count: images.length + videos.length,
        });
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

  const handleCreateFreeBook = useCallback(async () => {
    const state = useOurTailTalesStore.getState();
    track("free_book_generation_started", {
      photos: state.photos.length,
      chapters: state.chapterCount,
    });
    state.confirmBookSize();
    await handleCreateStory();
    const completed = useOurTailTalesStore.getState();
    setPreviewPreparing(true);
    let previewPdf: Blob | undefined;
    try {
      previewPdf = await renderFreePreviewPdf({
        pages: completed.pages,
        chapters: completed.chapters,
        meta: completed.meta,
        photos: photoMapOf(completed.photos),
      });
      completed.setFreePreviewReady(true);
    } catch (error) {
      captureClientException(error);
      setNotice("Your story is ready, but the PDF preview needs another try.");
    } finally {
      setPreviewPreparing(false);
    }
    await persistLocalDraft(useOurTailTalesStore.getState(), previewPdf).catch(() => {
      setNotice(
        "This browser could not save the finished draft for later. Keep this tab open to view it.",
      );
    });
    track("free_book_generation_completed", {
      chapters: completed.chapters.length,
      pages: completed.pages.length,
    });
  }, [handleCreateStory]);

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

  const stage = !localReady ? (
    <div className="quick-create-stage flex min-h-[calc(100dvh-5rem)] items-center justify-center">
      <span
        className="size-10 animate-spin rounded-full border-[3px] border-periwinkle/25 border-t-periwinkle"
        aria-label="Restoring your book"
      />
    </div>
  ) : funnelState === "idle" ||
    funnelState === "processing" ||
    funnelState === "album_ready" ? (
    <QuickUploadStage
      onFiles={handleFiles}
      onCreate={() => void handleCreateFreeBook()}
    />
  ) : funnelState === "organizing" ||
    funnelState === "ai_generating" ||
    previewPreparing ? (
    <BookGenerationStage />
  ) : store.freePreviewReady ? (
    <BookReadyStage
      onPreview={() => void requestProtectedAction("preview")}
      onPdf={() => void requestProtectedAction("pdf")}
      saving={cloudSaving}
      notice={notice}
    />
  ) : (
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
      enableVideoMemories={false}
    />
  );

  return (
    <>
      <KeepTabBanner active={hasWork && !embedded} />

      {embedded ? (
        <section
          id="create-free-book"
          aria-label="Create your free pet story"
          className="w-full scroll-mt-4"
        >
          {stage}
        </section>
      ) : (
        <main id="create-free-book" className="w-full flex-1 pb-0">
          <div className="brand-atmosphere px-5 py-5 sm:px-8">
            <div className="mx-auto max-w-[90rem]">
              <SiteHeader />
            </div>
          </div>
          {stage}
        </main>
      )}

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

      {authAction && (
        <BookAuthGate
          action={authAction}
          onClose={() => setAuthAction(null)}
          onAuthenticated={() => {
            const action = authAction;
            sessionStorage.removeItem("ourtailtales.pendingBookAction");
            setAuthAction(null);
            void saveAndPerformAction(action);
          }}
        />
      )}
    </>
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
