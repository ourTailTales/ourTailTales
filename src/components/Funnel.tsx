"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { AuthGate } from "@/components/auth/AuthGate";
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
import { saveBookProject } from "@/lib/books/cloud";
import { uploadFreePreview } from "@/lib/drafts/upload";
import { generateChapterStory } from "@/lib/story/client";
import { prepareOrder } from "@/lib/order/prepare";
import { placedMemoriesReadyForCheckout } from "@/lib/video-memory/checkout-ready";
import { draftHeaders, loadStoredDraft } from "@/lib/video-memory/client";
import { photoMapOf, useOurTailTalesStore } from "@/store/useOurTailTalesStore";
import { useIsAuthenticated } from "@/hooks/useIsAuthenticated";
import { authConfigured } from "@/lib/supabase/auth-browser";

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
  const [authOpen, setAuthOpen] = useState(false);
  const isAuthenticated = useIsAuthenticated();

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

  /** Uploads the preview and remembers the link it can be reopened from. */
  const bankPreview = useCallback(async (pdf: Blob): Promise<string> => {
    const state = useOurTailTalesStore.getState();
    const { url } = await uploadFreePreview({
      pdf,
      petName: state.meta.petName,
      chapterCount: state.chapterCount,
    });
    useOurTailTalesStore.getState().setBookUrl(url);
    track("free_pdf_stored", { chapters: state.chapterCount });
    return url;
  }, []);

  const runDownloadPdf = useCallback(async () => {
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

      // Hold the rendered preview in the local draft. It is what the account
      // copy uploads, and what a reload restores from — without it
      // saveBookProject has nothing to save.
      await persistLocalDraft(useOurTailTalesStore.getState(), blob).catch(
        (error: unknown) => captureClientException(error),
      );

      // Bank a copy so the book can be reopened from a link — another device,
      // or the email. Deliberately not awaited: the file the customer asked
      // for is already on its way, and a slow upload must not hold it up.
      void bankPreview(blob).catch((error: unknown) => {
        // The customer has their PDF; a failed upload only costs them the
        // link, so it is reported rather than surfaced as a failure.
        captureClientException(error);
      });

      // The copy that lives in their account. Best-effort for the same
      // reason: they already have the file, so a failure here costs them the
      // library entry, not the book.
      const saved = useOurTailTalesStore.getState();
      void saveBookProject({
        meta: saved.meta,
        chapters: saved.chapters,
        pages: saved.pages,
        photos: saved.photos,
      })
        .then(() => track("free_book_saved", { chapters: saved.chapterCount }))
        .catch((error: unknown) => captureClientException(error));
    } catch (error) {
      captureClientException(error);
      setNotice("Your PDF could not be prepared. Please try again.");
    } finally {
      setDownloadingPdf(false);
    }
  }, [bankPreview]);

  /**
   * The download is the one moment an account is worth asking for.
   *
   * By here the customer has a finished book on screen, so the trade is
   * legible: sign in and it stays in your library rather than in this
   * browser. Asking any earlier costs more of them than it returns.
   *
   * When Supabase Auth has no keys in this environment there is nothing to
   * sign in to, and blocking the download would be worse than skipping it.
   */
  const handleDownloadPdf = useCallback(async () => {
    if (!isAuthenticated && authConfigured()) {
      track("auth_gate_viewed");
      setAuthOpen(true);
      return;
    }
    await runDownloadPdf();
  }, [isAuthenticated, runDownloadPdf]);

  /**
   * The shareable link for this book, rendering and banking it first if the
   * customer has not downloaded the free PDF yet.
   */
  const ensureBookUrl = useCallback(async (): Promise<string> => {
    const existing = useOurTailTalesStore.getState().bookUrl;
    if (existing) return existing;

    const state = useOurTailTalesStore.getState();
    const blob = await renderFreePreviewPdf({
      pages: state.pages,
      chapters: state.chapters,
      meta: state.meta,
      photos: photoMapOf(state.photos),
    });
    return bankPreview(blob);
  }, [bankPreview]);

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

    // The sample is already on their device; the mail carries a link to the
    // whole book rather than an attachment, which no mailbox would accept at
    // this size and which would go stale the moment they bought it.
    // Awaited for its effect, not its value: the route refuses to mail a link
    // to a book that has not finished uploading.
    await ensureBookUrl();

    const draft = loadStoredDraft();
    if (!draft) return;

    const response = await fetch("/api/email/send-sample", {
      method: "POST",
      headers: {
        ...draftHeaders(draft.draftId, draft.secret),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, petName: state.meta.petName }),
    });
    const data = (await response.json().catch(() => ({}))) as {
      sent?: boolean;
      error?: string;
    };
    if (!response.ok || !data.sent) {
      // Their book exists and is downloadable either way, so this is reported
      // rather than thrown at someone who just handed over their address.
      captureClientException(
        new Error(data.error ?? "The book link email was not sent."),
      );
    }
  }, [ensureBookUrl]);

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

  // A failed confirmation link lands back here with ?authError=. Derived
  // rather than stored: the parameter was previously set by the auth callback
  // and read by nothing, so a broken link looked exactly like a working one.
  const authErrorNotice = searchParams.get("authError")
    ? "That sign-in link did not work — it may have already been used or expired. You can sign in again when you download."
    : null;

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
        notice={notice ?? authErrorNotice}
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

      {authOpen && (
        <AuthGate
          onClose={() => setAuthOpen(false)}
          onAuthenticated={() => {
            setAuthOpen(false);
            void runDownloadPdf();
          }}
        />
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
