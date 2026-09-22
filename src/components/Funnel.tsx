"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { EmailSampleModal } from "@/components/EmailSampleModal";
import { CreateHeaderActions } from "@/components/create/CreateHeaderActions";
import { SaveStatusIndicator } from "@/components/create/SaveStatusIndicator";
import { BookEditor } from "@/components/editor/BookEditor";
import { SiteHeader } from "@/components/SiteHeader";
import { captureClientException, identifyLead, track } from "@/lib/analytics";
import {
  previewFileName,
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
import { generateChapterStory } from "@/lib/story/client";
import { prepareOrder } from "@/lib/order/prepare";
import { placedMemoriesReadyForCheckout } from "@/lib/video-memory/checkout-ready";
import { photoMapOf, useOurTailTalesStore } from "@/store/useOurTailTalesStore";

/** Chapters written at once. Keeps the AI endpoint from being hammered. */
const STORY_CONCURRENCY = 2;

export function Funnel({ embedded = false }: { embedded?: boolean }) {
  const router = useRouter();
  const store = useOurTailTalesStore();

  const searchParams = useSearchParams();
  const ingestion = useRef<Ingestion | null>(null);
  const [sampleOpen, setSampleOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [localReady, setLocalReady] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  useEffect(() => {
    track("create_page_viewed");
    // Each customer's saved album/book lives under their own email, so the
    // very first restore needs to know which one to look up — a link with
    // ?email= identifies the visitor immediately; otherwise this starts (or
    // resumes) the shared anonymous slot, same as a pre-login cart.
    const emailParam = searchParams.get("email")?.trim() || null;
    void useOurTailTalesStore
      .getState()
      .restoreLocalBook(emailParam)
      .finally(() => setLocalReady(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- read once on mount by design
  }, []);

  // The landing-page email CTA already captured an email; carry it straight
  // into the draft instead of asking again. A draft restored from a previous
  // visit keeps its own saved email.
  useEffect(() => {
    if (!localReady) return;
    const emailParam = searchParams.get("email")?.trim();
    if (!emailParam) return;
    const current = useOurTailTalesStore.getState();
    if (current.leadEmail) return;
    current.setLeadEmail(emailParam);
    identifyLead(emailParam);
  }, [localReady, searchParams]);

  // Autosave: anything the customer types or picks — pet name, cover style,
  // dedication, chapter text, photo order, a custom cover upload — lands in
  // the local draft a moment after they stop editing, and the header's save
  // indicator flips to "saving" for that moment. Skips the very first render
  // after restore, since that's a read, not an edit.
  const autosaveHydrated = useRef(false);
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!localReady) return;
    if (!autosaveHydrated.current) {
      autosaveHydrated.current = true;
      return;
    }
    useOurTailTalesStore.getState().setSaveStatus("saving");
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    autosaveTimer.current = setTimeout(() => {
      void persistLocalDraft(useOurTailTalesStore.getState())
        .catch(() => {})
        .finally(() => useOurTailTalesStore.getState().setSaveStatus("saved"));
    }, 800);
    return () => {
      if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    };
  }, [localReady, store.meta, store.chapters, store.pages, store.customCover]);

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
        useOurTailTalesStore.getState().setSaveStatus("saving");
        void persistLocalDraft(useOurTailTalesStore.getState())
          .catch(() => {
            setNotice(
              "This browser could not save the album for later. Keep this tab open while creating your book.",
            );
          })
          .finally(() => useOurTailTalesStore.getState().setSaveStatus("saved"));
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
    const completed = useOurTailTalesStore.getState();
    track("story_generated", { chapters: completed.chapters.length });
    completed.setSaveStatus("saving");
    await persistLocalDraft(completed)
      .catch(() => {
        setNotice(
          "This browser could not save the finished draft for later. Keep this tab open to view it.",
        );
      })
      .finally(() => useOurTailTalesStore.getState().setSaveStatus("saved"));
  }, [runStories]);

  const handleDownloadPdf = useCallback(async () => {
    const state = useOurTailTalesStore.getState();
    if (state.pages.length === 0) return;
    setDownloadingPdf(true);
    setNotice(null);
    try {
      const blob = await renderFreePreviewPdf({
        pages: state.pages,
        chapters: state.chapters,
        meta: state.meta,
        photos: photoMapOf(state.photos),
      });
      downloadBlob(blob, previewFileName(state.meta.petName));
      track("free_pdf_downloaded", { chapters: state.chapterCount });
    } catch (error) {
      captureClientException(error);
      setNotice("Your PDF could not be prepared. Please try again.");
    } finally {
      setDownloadingPdf(false);
    }
  }, []);

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
        customCover: state.customCover,
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
  ) : (
    <div className="w-full pb-16">
      <BookEditor
        onFiles={handleFiles}
        onStartOver={() => {
          ingestion.current?.cancel();
          store.reset();
        }}
        onCreateStory={() => void handleCreateStory()}
        onSample={() => setSampleOpen(true)}
        onCheckout={() => void handleCheckout()}
        onRegenerate={(chapterId) => void runStories([chapterId])}
        notice={notice}
        enableVideoMemories={false}
      />
    </div>
  );

  return (
    <>
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
          <div className="brand-atmosphere py-5">
            <div className="mx-auto w-full max-w-[100rem] px-5 sm:px-8 lg:pl-8 lg:pr-14">
              <SiteHeader
                status={<SaveStatusIndicator />}
                right={
                  <CreateHeaderActions
                    onDownloadPdf={() => void handleDownloadPdf()}
                    downloading={downloadingPdf}
                  />
                }
              />
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
