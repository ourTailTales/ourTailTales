"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { AuthGate } from "@/components/auth/AuthGate";
import { EmailSampleModal } from "@/components/EmailSampleModal";
import { SaveStatusIndicator } from "@/components/create/SaveStatusIndicator";
import { BookFlow } from "@/components/studio/BookFlow";
import { SiteHeader } from "@/components/SiteHeader";
import { captureClientException, identifyLead, track } from "@/lib/analytics";
import {
  previewFileName,
  renderFullPreviewPdf,
  renderTeaserPdf,
  teaserFileName,
} from "@/lib/book/sample-pdf";
import { summarizeTeaser } from "@/lib/book/teaser";
import {
  partitionMedia,
  startIngestion,
  type Ingestion,
} from "@/lib/photo/process";
import { makeVideoPreview } from "@/lib/photo/videoPreview";
import { persistLocalDraft } from "@/lib/drafts/local";
import { saveBookProject } from "@/lib/books/cloud";
import { bankBook } from "@/lib/drafts/upload";
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
  const [askEmail, setAskEmail] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [localReady, setLocalReady] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const isAuthenticated = useIsAuthenticated();

  // Supabase Auth with no keys in this environment means there is nothing to
  // sign in to, and a wall nobody can climb is worse than no wall.
  const unlocked = isAuthenticated || !authConfigured();

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
            store.addAlbumVideos([{ id, fileName: file.name, ...preview }]);
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
      species: state.meta.species,
      stillHere: state.meta.stillHere,
      notes: state.meta.notes,
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

  /**
   * Renders the free ten pages, banks them, and mails them.
   *
   * Everything here is best effort and none of it is awaited by the customer:
   * the book is already on their screen by the time this runs, so a failed
   * upload costs them the email copy, not the book. The email exists for the
   * person who closes the tab — it is the way back in, not the way through.
   */
  const deliverTeaser = useCallback(async (): Promise<void> => {
    const state = useOurTailTalesStore.getState();
    if (state.pages.length === 0) return;

    const teaser = summarizeTeaser(state.pages, state.chapters);
    const pdf = await renderTeaserPdf({
      pages: state.pages,
      chapters: state.chapters,
      meta: state.meta,
      photos: photoMapOf(state.photos),
    });

    const banked = await bankBook({
      pdf,
      petName: state.meta.petName,
      chapterCount: state.chapterCount,
      kind: "teaser",
    });
    useOurTailTalesStore.getState().setBookUrl(banked.url);
    track("free_pdf_stored", { chapters: state.chapterCount });

    const email = useOurTailTalesStore.getState().leadEmail;
    if (!email) return;

    const draft = loadStoredDraft();
    if (!draft) return;

    const response = await fetch("/api/email/send-sample", {
      method: "POST",
      headers: {
        ...draftHeaders(draft.draftId, draft.secret),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email,
        petName: state.meta.petName,
        hiddenChapters: teaser.hiddenChapters,
        hiddenPages: teaser.hiddenPages,
      }),
    });
    const data = (await response.json().catch(() => ({}))) as {
      sent?: boolean;
      error?: string;
    };
    if (!response.ok || !data.sent) {
      captureClientException(
        new Error(data.error ?? "The book email was not sent."),
      );
      return;
    }
    track("teaser_email_sent", { chapters: state.chapterCount });
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
          "This browser could not save the finished book. Keep this tab open to read it.",
        );
      })
      .finally(() => useOurTailTalesStore.getState().setSaveStatus("saved"));

    void deliverTeaser().catch((error: unknown) =>
      captureClientException(error),
    );
  }, [runStories, deliverTeaser]);

  /**
   * What the account actually buys.
   *
   * The whole book is rendered, kept in the local draft, banked so the emailed
   * link and a later PDF purchase both resolve to a complete file, and written
   * into their library. Banking has to happen before anyone can buy the clean
   * PDF — the checkout route refuses until it has.
   */
  const claimBook = useCallback(async (): Promise<void> => {
    const state = useOurTailTalesStore.getState();
    if (state.pages.length === 0) return;

    const pdf = await renderFullPreviewPdf({
      pages: state.pages,
      chapters: state.chapters,
      meta: state.meta,
      photos: photoMapOf(state.photos),
    });

    await persistLocalDraft(useOurTailTalesStore.getState(), pdf);

    const banked = await bankBook({
      pdf,
      petName: state.meta.petName,
      chapterCount: state.chapterCount,
      kind: "full",
    }).catch((error: unknown) => {
      captureClientException(error);
      return null;
    });
    if (banked) useOurTailTalesStore.getState().setBookUrl(banked.url);

    const saved = useOurTailTalesStore.getState();
    await saveBookProject({
      meta: saved.meta,
      chapters: saved.chapters,
      pages: saved.pages,
      photos: saved.photos,
    });
    track("free_book_saved", { chapters: saved.chapterCount });
  }, []);

  const handleAuthenticated = useCallback(() => {
    setAuthOpen(false);
    // Every page is readable the instant the session exists. Rendering and
    // banking the whole book takes longer than that and happens behind them,
    // so this says what is going on rather than leaving a silent minute.
    setNotice("Saving the whole book to your library…");
    void claimBook()
      .then(() => setNotice(null))
      .catch((error: unknown) => {
        captureClientException(error);
        setNotice(
          "Your book is open, but saving it to your library did not work. It is still here in this browser — try reloading.",
        );
      });
  }, [claimBook]);

  const handleUnlock = useCallback(() => {
    if (unlocked) return;
    track("auth_gate_viewed");
    setAuthOpen(true);
  }, [unlocked]);

  /**
   * The download button. Signed out it hands over the free pages; signed in it
   * hands over the whole book. Same button, and what it produces matches
   * exactly what is readable on screen at the time.
   */
  const handleDownload = useCallback(async () => {
    const state = useOurTailTalesStore.getState();
    if (state.pages.length === 0) return;
    setDownloadingPdf(true);
    setNotice(null);
    try {
      const photos = photoMapOf(state.photos);
      const args = {
        pages: state.pages,
        chapters: state.chapters,
        meta: state.meta,
        photos,
      };
      const blob = unlocked
        ? await renderFullPreviewPdf(args)
        : await renderTeaserPdf(args);

      downloadBlob(
        blob,
        unlocked
          ? previewFileName(state.meta.petName)
          : teaserFileName(state.meta.petName),
      );
      track("free_pdf_downloaded", {
        chapters: state.chapterCount,
        whole: unlocked,
      });
    } catch (error) {
      captureClientException(error);
      setNotice("Your PDF could not be prepared. Please try again.");
    } finally {
      setDownloadingPdf(false);
    }
  }, [unlocked]);

  /** Someone reached the book without ever giving us an address. */
  const handleEmailSubmit = useCallback(
    async (email: string) => {
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
        // Never block the book on lead capture.
      });

      await deliverTeaser();
    },
    [deliverTeaser],
  );

  const handleCheckout = useCallback(async () => {
    setNotice(null);
    const state = useOurTailTalesStore.getState();

    try {
      if (state.placements.length > 0 && (!state.draftId || !state.draftSecret)) {
        throw new Error(
          "Your Video Memories could not be saved. Please try again.",
        );
      }
      if (!placedMemoriesReadyForCheckout(state.placements, state.videoAssets)) {
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
    ? "That sign-in link did not work — it may have already been used or expired. You can sign in again from your book."
    : null;

  const stage = !localReady ? (
    <div className="flex min-h-[calc(100dvh-5rem)] items-center justify-center">
      <span
        className="size-10 animate-spin rounded-full border-[3px] border-periwinkle/25 border-t-periwinkle"
        aria-label="Restoring your book"
      />
    </div>
  ) : (
    <BookFlow
      onFiles={handleFiles}
      onStartOver={() => {
        ingestion.current?.cancel();
        store.reset();
      }}
      onCreateStory={() => void handleCreateStory()}
      onRegenerate={(chapterId) => void runStories([chapterId])}
      onUnlock={handleUnlock}
      onDownload={() => void handleDownload()}
      onCheckout={() => void handleCheckout()}
      unlocked={unlocked}
      downloading={downloadingPdf}
      notice={notice ?? authErrorNotice}
    />
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
            <div className="mx-auto w-full max-w-[90rem] px-5 sm:px-8">
              <SiteHeader
                status={<SaveStatusIndicator />}
                right={
                  store.leadEmail ? null : (
                    <button
                      type="button"
                      onClick={() => setAskEmail(true)}
                      className="rounded-full border border-page-line bg-white px-4 py-2 text-sm font-semibold text-page-ink shadow-sm hover:border-periwinkle"
                    >
                      Email me my book
                    </button>
                  )
                }
              />
            </div>
          </div>
          {stage}
        </main>
      )}

      {authOpen && (
        <AuthGate
          initialEmail={store.leadEmail}
          onClose={() => setAuthOpen(false)}
          onAuthenticated={handleAuthenticated}
        />
      )}

      {askEmail && (
        <EmailSampleModal
          onClose={() => setAskEmail(false)}
          onSubmit={handleEmailSubmit}
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
