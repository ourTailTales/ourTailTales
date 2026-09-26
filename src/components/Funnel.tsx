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
import { previewExpiryFrom } from "@/lib/drafts/expiry";
import { persistLocalDraft } from "@/lib/drafts/local";
import { saveBookProject } from "@/lib/books/cloud";
import { bankBook } from "@/lib/drafts/upload";
import { generateChapterStory } from "@/lib/story/client";
import { generatePetProfile } from "@/lib/story/profile";
import { prepareOrder } from "@/lib/order/prepare";
import { placedMemoriesReadyForCheckout } from "@/lib/video-memory/checkout-ready";
import { draftHeaders, loadStoredDraft } from "@/lib/video-memory/client";
import { photoMapOf, useOurTailTalesStore } from "@/store/useOurTailTalesStore";
import { useIsAuthenticated } from "@/hooks/useIsAuthenticated";
import { authConfigured } from "@/lib/supabase/auth-browser";

/** Chapters written at once. Keeps the AI endpoint from being hammered. */
const STORY_CONCURRENCY = 2;

/**
 * How long one chapter may take before we give up on it.
 *
 * `generateChapterStory` accepts an `AbortSignal` and nothing ever passed
 * one, so a request that never answered never failed either: the progress bar
 * stopped where it was and the screen waited for the rest of somebody's life
 * indefinitely. Generously above what the route itself allows, so this only
 * catches a request that is genuinely lost rather than one that is slow.
 */
const STORY_TIMEOUT_MS = 90_000;

/** The profile look is worth waiting a little for, not a lot. */
const PROFILE_TIMEOUT_MS = 25_000;

export function Funnel({ embedded = false }: { embedded?: boolean }) {
  const router = useRouter();
  const store = useOurTailTalesStore();

  const searchParams = useSearchParams();
  const ingestion = useRef<Ingestion | null>(null);
  const [askEmail, setAskEmail] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  /** Which address the album in memory was loaded for. */
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const isAuthenticated = useIsAuthenticated();

  // Supabase Auth with no keys in this environment means there is nothing to
  // sign in to, and a wall nobody can climb is worse than no wall.
  const unlocked = isAuthenticated || !authConfigured();

  useEffect(() => {
    track("create_page_viewed");
  }, []);

  /**
   * Loads the book for whichever address the visitor arrived as.
   *
   * Keyed on the address rather than run once on mount, because the landing
   * page navigates here client side: a second address submitted there changes
   * the query string without remounting anything, and this component used to
   * never look again. The book already in memory stayed on screen, so a
   * different person saw the previous person's pet.
   */
  const emailParam = searchParams.get("email")?.trim() || null;
  const emailKey = emailParam ?? "";
  // Derived rather than set: the moment the address changes this is false
  // again, without an effect having to remember to say so.
  const localReady = loadedFor === emailKey;

  useEffect(() => {
    let current = true;
    void useOurTailTalesStore
      .getState()
      .restoreLocalBook(emailParam)
      .finally(() => {
        if (!current) return;
        // A restored book keeps the address it was saved under; a fresh one
        // takes the address that asked for it.
        const state = useOurTailTalesStore.getState();
        if (emailParam && !state.leadEmail) {
          state.setLeadEmail(emailParam);
          identifyLead(emailParam);
        }
        setLoadedFor(emailKey);
      });
    return () => {
      current = false;
    };
  }, [emailParam, emailKey]);

  // Autosave: anything the customer types or picks — pet name, cover style,
  // dedication, chapter text, photo order, a custom cover upload — lands in
  // the local draft a moment after they stop editing, and the header's save
  // indicator flips to "saving" for that moment. Skips the very first render
  // after restore, since that's a read, not an edit.
  // Which identity the autosave has already seen. A plain boolean was set
  // once for the life of the tab, so after a second restore the "this is a
  // read, not an edit" skip stopped working and every arrival wrote the whole
  // album back out again.
  const autosaveHydrated = useRef<string | null>(null);
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /**
   * Writes the draft and says what actually happened.
   *
   * This used to swallow every rejection and then flip the pill to "Saved"
   * regardless. A hundred-photo album plus a whole-book PDF rewritten on
   * every pause is exactly the shape that makes a browser refuse, so the one
   * case the indicator existed for was the one it lied about: the customer
   * read "Saved", closed the tab, and the book was gone.
   */
  const save = useCallback(async (previewPdf?: Blob): Promise<boolean> => {
    try {
      const result = await persistLocalDraft(
        useOurTailTalesStore.getState(),
        previewPdf,
      );
      useOurTailTalesStore.getState().setSaveStatus("saved");
      if (result && result.missingPhotos > 0) {
        captureClientException(
          new Error(`Saved without ${result.missingPhotos} photo(s).`),
        );
      }
      return true;
    } catch (error) {
      useOurTailTalesStore.getState().setSaveStatus("error");
      captureClientException(error);
      return false;
    }
  }, []);

  useEffect(() => {
    if (!localReady) return;
    if (autosaveHydrated.current !== emailKey) {
      autosaveHydrated.current = emailKey;
      return;
    }
    useOurTailTalesStore.getState().setSaveStatus("saving");
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    autosaveTimer.current = setTimeout(() => {
      autosaveTimer.current = null;
      void save();
    }, 800);
    return () => {
      if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    };
    // The album belongs in here as much as the text does. Without it, adding
    // photos or capturing an address did not re-key the draft until some
    // unrelated edit happened to come along.
  }, [
    localReady,
    emailKey,
    save,
    store.meta,
    store.chapters,
    store.pages,
    store.customCover,
    store.photos,
    store.albumVideos,
    store.leadEmail,
    store.bookExpiresAt,
  ]);

  // An edit followed by a close inside the debounce window was simply lost,
  // with the pill still reading "Saved". `visibilitychange` is the one that
  // actually fires when a phone browser is dismissed; `beforeunload` does not.
  useEffect(() => {
    const flush = (): void => {
      if (!autosaveTimer.current) return;
      clearTimeout(autosaveTimer.current);
      autosaveTimer.current = null;
      void save();
    };
    const onHide = (): void => {
      if (document.visibilityState === "hidden") flush();
    };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", flush);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", flush);
    };
  }, [save]);

  const handleFiles = useCallback(
    (files: File[], target?: { chapterId: string; pageIndex: number }) => {
      const { images, videos } = partitionMedia(files);
      if (images.length === 0 && videos.length === 0) {
        // Dropping a folder of PDFs or raw files used to do nothing at all,
        // silently, which looks exactly like a broken page.
        if (files.length > 0) {
          setNotice(
            "Those files are not photos or videos, so there was nothing to add.",
          );
        }
        return;
      }

      // Only while the book is sitting still.
      //
      // Two separate failures live here. A second batch started while the
      // first is still being read overwrote the running ingestion without
      // cancelling it, and whichever finished first declared the album ready,
      // so chapters were built from half of it and never rebuilt. And a drop
      // during writing is worse: finishing the batch sets the state back to
      // `album_ready` while chapters are still being written, which reopens
      // the generation step and pays for the unwritten chapters a second
      // time. The drop zone covers the waiting screen, so this is one
      // mis-aimed file away at any point in the wait.
      const busy = useOurTailTalesStore.getState().funnelState;
      if (busy !== "idle" && busy !== "album_ready" && busy !== "editing") {
        setNotice(
          busy === "ai_generating"
            ? "We are still writing the chapters. Add more photos once the book opens."
            : "Still reading the last batch. Try again in a moment.",
        );
        return;
      }

      track("album_selected", { count: images.length + videos.length });
      store.startProcessing(images.length + videos.length);
      track("album_processing_started", {
        count: images.length + videos.length,
      });

      // What arrived, when these files were chosen for one page rather than
      // for the album at large.
      const arrived: string[] = [];

      const photosDone = new Promise<void>((resolve) => {
        if (images.length === 0) {
          resolve();
          return;
        }
        ingestion.current = startIngestion(images, {
          onBatch: (batch) => {
            store.addProcessedPhotos(batch);
            if (target) {
              // A picture too small to print is not put on a page; it stays in
              // the album, where it can still be looked at and chosen.
              for (const photo of batch) if (photo.usable) arrived.push(photo.id);
            }
          },
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

        // Chosen while looking at a page, so that is where they go — and the
        // editor turns to whichever page the last of them landed on, which is
        // a new one when the page they were meant for was already full.
        if (target && arrived.length > 0) {
          store.addPhotosToPage(target.chapterId, target.pageIndex, arrived);
        } else if (target) {
          setNotice(
            images.length > 0
              ? "Those pictures are too small to print, so they were kept in the album rather than put on the page."
              : "Only photos can go on a page. Videos are added in the Videos tab.",
          );
        }

        useOurTailTalesStore.getState().setSaveStatus("saving");
        void save().then((ok) => {
          if (!ok) {
            setNotice(
              "This browser could not save the album for later. Keep this tab open while creating your book.",
            );
          }
        });
        track("album_processing_completed", {
          count: images.length + videos.length,
        });
      });
    },
    [store, save],
  );

  /** Set while chapters are being written, so the customer can stop it. */
  const storyRun = useRef<AbortController | null>(null);

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
      profile: state.meta.petProfile,
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

        // One deadline per chapter, plus whatever the customer decides.
        const chapterAbort = new AbortController();
        const timer = setTimeout(
          () => chapterAbort.abort(),
          STORY_TIMEOUT_MS,
        );
        const stopAll = (): void => chapterAbort.abort();
        storyRun.current?.signal.addEventListener("abort", stopAll);

        try {
          const { story, places } = await generateChapterStory(
            chapter,
            photoMap,
            context,
            chapterAbort.signal,
            {
              chapterNumber: chapter.index + 1,
              chapterCount: useOurTailTalesStore.getState().chapters.length,
            },
          );
          actions.setChapterPlaces(chapterId, places);
          actions.applyChapterStory(chapterId, story);
        } catch (error) {
          const stopped = storyRun.current?.signal.aborted === true;
          actions.setChapterAiStatus(
            chapterId,
            "error",
            stopped
              ? "You stopped this one. Write it again whenever you like."
              : chapterAbort.signal.aborted
                ? "This chapter took too long to write. Try it again."
                : error instanceof Error
                  ? error.message
                  : "Story generation failed.",
          );
        } finally {
          clearTimeout(timer);
          storyRun.current?.signal.removeEventListener("abort", stopAll);
        }
      }
    };

    await Promise.all(
      Array.from({ length: Math.min(STORY_CONCURRENCY, queue.length) }, worker),
    );
  }, []);

  /** One teaser at a time: the reload check and a fresh book can race. */
  const teaserInFlight = useRef(false);
  const deliverTeaser = useCallback(async (): Promise<void> => {
    const state = useOurTailTalesStore.getState();
    if (state.pages.length === 0 || teaserInFlight.current) return;
    teaserInFlight.current = true;
    try {
      await deliverTeaserOnce();
    } finally {
      teaserInFlight.current = false;
    }
  }, []);

  /**
   * The expiry banner must be on every preview, including one reopened after
   * a reload. A book saved before the browser kept the expiry has none, so
   * ask the server once; a book that was never banked at all (the upload
   * failed, or the tab closed first) is banked now, which starts its clock.
   */
  const expiryChecked = useRef<string | null>(null);
  useEffect(() => {
    if (!localReady || expiryChecked.current === emailKey) return;
    expiryChecked.current = emailKey;

    const state = useOurTailTalesStore.getState();
    if (state.bookExpiresAt || state.pages.length === 0) return;
    if (state.funnelState !== "editing") return;

    const draft = loadStoredDraft(state.leadEmail);
    void (async () => {
      if (draft) {
        const response = await fetch("/api/drafts/status", {
          headers: draftHeaders(draft.draftId, draft.secret),
        });
        const data = (await response.json().catch(() => ({}))) as {
          banked?: boolean;
          expiresAt?: string | null;
        };
        if (!response.ok) return;
        if (data.expiresAt) {
          useOurTailTalesStore
            .getState()
            .setBookExpiresAt(new Date(data.expiresAt));
          return;
        }
        // Banked with no expiry: bought, or kept by an account. Nothing
        // is running out.
        if (data.banked) return;
      }
      await deliverTeaser();
    })().catch((error: unknown) => captureClientException(error));
  }, [localReady, emailKey, deliverTeaser]);

  const handleCreateStory = useCallback(async () => {
    const state = useOurTailTalesStore.getState();

    // Only what is still unwritten. A draft picked up after a reload or a
    // failed chapter comes back with most of the book already written, and
    // rewriting those would both pay for them twice and throw away anything
    // the customer had already changed.
    const pending = state.chapters
      .filter((chapter) => chapter.aiStatus !== "done")
      .map((chapter) => chapter.id);

    storyRun.current = new AbortController();
    state.beginStoryGeneration();
    await lookAtThePet(storyRun.current.signal);
    await runStories(pending);
    storyRun.current = null;
    useOurTailTalesStore.getState().finishStoryGeneration();
    const completed = useOurTailTalesStore.getState();
    track("story_generated", { chapters: completed.chapters.length });
    // The top of the book → order funnel: counted once, when a book is first
    // written, not again for a chapter retried later.
    if (pending.length === state.chapters.length && state.chapters.length > 0) {
      track("book_created", {
        chapters: completed.chapters.length,
        photos: completed.photos.length,
        has_dedication: completed.meta.dedication.trim().length > 0,
      });
    }

    completed.setSaveStatus("saving");
    if (!(await save())) {
      setNotice(
        "This browser could not save the finished book. Keep this tab open to read it.",
      );
    }

    void deliverTeaser().catch((error: unknown) =>
      captureClientException(error),
    );
  }, [runStories, deliverTeaser, save]);

  /**
   * Stop writing and open whatever is finished.
   *
   * The wait had no exit at all: no cancel, and the only retry lived behind a
   * button on a screen you could not reach from here. A hung request was
   * therefore a dead end at the most expensive moment in the funnel. Stopping
   * marks the rest as failed rather than losing them, and every one of them
   * can be written again from the editor.
   */
  const stopStory = useCallback(() => {
    storyRun.current?.abort();
  }, []);

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

    // Best effort, deliberately. This is a local cache of the rendered book,
    // and it now rejects when the browser refuses the write. Awaited bare, a
    // full disk aborted this function before the book was banked, so the
    // emailed link never resolved and the PDF could not be sold: a cache
    // failure took out the sale.
    await save(pdf);

    const banked = await bankBook({
      pdf,
      petName: state.meta.petName,
      chapterCount: state.chapterCount,
      kind: "full",
      email: state.leadEmail,
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
  }, [save]);

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
          "Your book is open, but saving it to your library did not work. It is still here in this browser. Try reloading.",
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
        : await renderTeaserPdf({
            ...args,
            expiresAt: state.bookExpiresAt ?? previewExpiryFrom(),
          });

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

      const { orderId, orderToken } = await prepareOrder({
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
      router.push(
        `/checkout?order=${orderId}&t=${encodeURIComponent(orderToken)}`,
      );
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
    ? "That sign-in link did not work. It may have already been used or expired. You can sign in again from your book."
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
      onStopStory={stopStory}
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
                status={
                  // Only while someone can actually edit the book. A
                  // signed-out reader of the free preview has nothing to
                  // save, so "Saved" meant nothing to them.
                  unlocked &&
                  (store.funnelState === "editing" ||
                    store.funnelState === "exporting") ? (
                    <SaveStatusIndicator />
                  ) : null
                }
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

/**
 * Renders the free ten pages, banks them, and mails them.
 *
 * Everything here is best effort and none of it is awaited by the customer:
 * the book is already on their screen by the time this runs, so a failed
 * upload costs them the email copy, not the book. The email exists for the
 * person who closes the tab — it is the way back in, not the way through.
 */
/**
 * One look at the pet before the chapters are written: what they look like
 * and wear (so every chapter describes the same dog) and the book's colors.
 * Best effort and time-boxed — without it the chapters are still written and
 * the book keeps its classic colors.
 */
async function lookAtThePet(stop: AbortSignal): Promise<void> {
  const state = useOurTailTalesStore.getState();
  if (state.meta.petProfile) return;

  const timeout = new AbortController();
  const timer = setTimeout(() => timeout.abort(), PROFILE_TIMEOUT_MS);
  const onStop = (): void => timeout.abort();
  stop.addEventListener("abort", onStop);
  try {
    const profile = await generatePetProfile(
      { meta: state.meta, chapters: state.chapters, photos: state.photos },
      timeout.signal,
    );
    useOurTailTalesStore.getState().setMeta({ petProfile: profile, paletteIndex: 0 });
  } catch (error) {
    if (!timeout.signal.aborted) captureClientException(error);
  } finally {
    clearTimeout(timer);
    stop.removeEventListener("abort", onStop);
  }
}

async function deliverTeaserOnce(): Promise<void> {
  const state = useOurTailTalesStore.getState();
  if (state.pages.length === 0) return;

  const teaser = summarizeTeaser(state.pages, state.chapters);
  const pdf = await renderTeaserPdf({
    pages: state.pages,
    chapters: state.chapters,
    meta: state.meta,
    photos: photoMapOf(state.photos),
    // The server starts the same clock when this lands, a moment from now.
    expiresAt: state.bookExpiresAt ?? previewExpiryFrom(),
  });

  const banked = await bankBook({
    pdf,
    petName: state.meta.petName,
    chapterCount: state.chapterCount,
    kind: "teaser",
    email: state.leadEmail,
  });
  useOurTailTalesStore.getState().setBookUrl(banked.url);
  useOurTailTalesStore
    .getState()
    .setBookExpiresAt(banked.expiresAt ? new Date(banked.expiresAt) : null);
  track("free_pdf_stored", { chapters: state.chapterCount });

  const email = useOurTailTalesStore.getState().leadEmail;
  if (!email) return;

  const draft = loadStoredDraft(email);
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
