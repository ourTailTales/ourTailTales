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
  renderCleanBookPdf,
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
import { getLocalDraftId, persistLocalDraft } from "@/lib/drafts/local";
import { saveBookProject } from "@/lib/books/cloud";
import { bankBook } from "@/lib/drafts/upload";
import { generateChapterStory } from "@/lib/story/client";
import { withoutUsedCaptions } from "@/lib/story/lines";
import { generatePetProfile } from "@/lib/story/profile";
import { bankCleanBookForOrder } from "@/lib/drafts/claim";
import { prepareOrder } from "@/lib/order/prepare";
import { bookSpec } from "@/lib/pricing";
import { placedMemoriesReadyForCheckout } from "@/lib/video-memory/checkout-ready";
import { draftHeaders, ensureDraft, loadStoredDraft } from "@/lib/video-memory/client";
import { VideoMemoriesFlagProvider } from "@/lib/video-memory/flag-context";
import {
  exhaustedPartialClaims,
  photoMapOf,
  useOurTailTalesStore,
  type ClaimOutcome,
} from "@/store/useOurTailTalesStore";
import { shouldAutoClaim } from "@/components/auth/auto-claim";
import { useSessionEmail } from "@/components/auth/useSessionEmail";
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

/** Where the book is: still being edited, or being looked at before ordering. */
export type FunnelStep = "edit" | "finish";

/** The address the book already in memory was restored for, or null. */
let hydratedFor: string | null = null;

/**
 * Whether this tab has already counted a look at the create flow.
 *
 * Finishing a book is a client-side navigation to another route, which mounts
 * a second `Funnel`. Without this, going to the price list and back counted
 * as two more people arriving at the editor.
 */
let viewTracked = false;

/**
 * A save to the account that has been asked for and not yet announced.
 *
 * The save itself is tracked in the store (`claim`), which both mounts of
 * this component read: the editor and the finish step. This only covers the
 * moment before that, while a book that has never been saved locally is
 * given an id, so two callers cannot both start one.
 */
let claimStarting = false;

const CLAIM_SAVING_NOTICE = "Saving the whole book to your library…";
const CLAIM_FAILED_NOTICE =
  "Your book is open, but saving it to your library did not work. It is still here in this browser. Try reloading.";

export function Funnel({
  embedded = false,
  step = "edit",
  videoMemoriesEnabled = false,
}: {
  embedded?: boolean;
  step?: FunnelStep;
  /**
   * The server-side `VIDEO_MEMORIES_ENABLED` flag, read by the page that
   * renders this. Off means videos are treated as absent everywhere below.
   */
  videoMemoriesEnabled?: boolean;
}) {
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
  const sessionEmail = useSessionEmail();

  // Supabase Auth with no keys in this environment means there is nothing to
  // sign in to, and a wall nobody can climb is worse than no wall.
  const unlocked = isAuthenticated || !authConfigured();

  useEffect(() => {
    if (viewTracked) return;
    viewTracked = true;
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
  // again, without an effect having to remember to say so. `hydratedFor`
  // outlives the component, so a book restored on the editor route is ready
  // on the first render of the one after it.
  const localReady = loadedFor === emailKey || hydratedFor === emailKey;

  useEffect(() => {
    // Already in memory for this person, and `localReady` says so without
    // waiting. Restoring again would read the whole album back off disk over
    // edits the autosave has not written yet — which is exactly what
    // finishing a book does, since that is a client-side navigation to
    // another route and so a second mount of this component.
    if (hydratedFor === emailKey) return;

    let current = true;
    void useOurTailTalesStore
      .getState()
      .restoreLocalBook(emailParam)
      .finally(() => {
        hydratedFor = emailKey;
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
  // chapter text, photo order, a custom cover upload — lands in
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
      const media = partitionMedia(files);
      const images = media.images;
      // With Video Memories off a video has nowhere to go, so it is left out
      // here, at the one place every upload path passes through.
      const videos = videoMemoriesEnabled ? media.videos : [];
      if (images.length === 0 && videos.length === 0) {
        // Dropping a folder of PDFs or raw files used to do nothing at all,
        // silently, which looks exactly like a broken page.
        if (files.length > 0) {
          setNotice(
            videoMemoriesEnabled
              ? "Those files are not photos or videos, so there was nothing to add."
              : "Those files are not photos, so there was nothing to add.",
          );
        }
        return;
      }
      if (!videoMemoriesEnabled && media.videos.length > 0) {
        setNotice(
          media.videos.length === 1
            ? "We could not use 1 video. Only photos go in the book."
            : `We could not use ${media.videos.length} videos. Only photos go in the book.`,
        );
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
      // How long an album actually takes to read, on the machines customers
      // actually have. Reading four thousand photographs is the difference
      // between this product working and not, and until this was measured the
      // only evidence was somebody saying it felt slow.
      const readingFrom = Date.now();

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
              : videoMemoriesEnabled
                ? "Only photos can go on a page. Videos are added in the Videos tab."
                : "Only photos can go on a page.",
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
        const seconds = Math.round((Date.now() - readingFrom) / 100) / 10;
        const read = images.length + videos.length;
        track("album_processing_completed", {
          count: read,
          seconds,
          per_photo_ms: read > 0 ? Math.round((seconds * 1000) / read) : 0,
        });
      });
    },
    [store, save, videoMemoriesEnabled],
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
          const { story, places, spotlightIds } = await generateChapterStory(
            chapter,
            photoMap,
            context,
            chapterAbort.signal,
            {
              chapterNumber: chapter.index + 1,
              chapterCount: useOurTailTalesStore.getState().chapters.length,
            },
            // Read fresh, right before the request goes out, so a chapter
            // that finished writing moments ago is already on the list —
            // the two workers running alongside each other mean this can
            // never be complete, but it catches the common case: most
            // repeats are between chapters that did not run at the exact
            // same moment.
            usedPhrasesSoFar(chapterId),
          );
          actions.setChapterPlaces(chapterId, places);
          // Read again now that it is written: the chapter being written
          // alongside this one may have finished in the meantime, and neither
          // could see the other's lines. Whichever finishes second gives up
          // the captions the book already has; its title is left alone.
          actions.applyChapterStory(
            chapterId,
            withoutUsedCaptions(story, usedPhrasesSoFar(chapterId).captions),
            spotlightIds,
          );
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
  const claimBook = useCallback(
    async (draftId: string): Promise<ClaimOutcome> => {
      const state = useOurTailTalesStore.getState();

      // Everything below is slow, and the customer is free to start over or
      // open another address while it runs. Re-reading the store afterwards
      // and trusting it used to save an empty or different book and mark the
      // new one as kept. So the book is named once, here, and nothing is
      // written unless the book on screen is still that one.
      const stillThisBook = (): boolean => {
        const now = useOurTailTalesStore.getState();
        return (
          now.localDraftId === draftId &&
          getLocalDraftId() === draftId &&
          now.pages.length > 0
        );
      };
      if (!stillThisBook()) return "abandoned";

      const pdf = await renderCleanBookPdf({
        pages: state.pages,
        chapters: state.chapters,
        meta: state.meta,
        photos: photoMapOf(state.photos),
      });
      if (!stillThisBook()) return "abandoned";

      // Best effort, deliberately. This is a local cache of the rendered book,
      // and it now rejects when the browser refuses the write. Awaited bare, a
      // full disk aborted this function before the book was banked, so the
      // emailed link never resolved and the PDF could not be sold: a cache
      // failure took out the sale.
      await save(pdf);
      if (!stillThisBook()) return "abandoned";

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
      if (!stillThisBook()) return "abandoned";
      if (banked) useOurTailTalesStore.getState().setBookUrl(banked.url);

      const saved = useOurTailTalesStore.getState();
      await saveBookProject({
        meta: saved.meta,
        chapters: saved.chapters,
        pages: saved.pages,
        photos: saved.photos,
      });
      track("free_book_saved", { chapters: saved.chapterCount });
      if (!stillThisBook()) return "abandoned";

      // Only once it is both banked and in the library. A book that got half
      // way is tried again when it is next opened signed in, and only once
      // more: see `exhaustedPartialClaims`.
      if (!banked) return "partial";
      useOurTailTalesStore.getState().setClaimedAt(new Date().toISOString());
      await save();
      return "claimed";
    },
    [save],
  );

  /**
   * Saves the book on screen to the account, once.
   *
   * Asked for from two places: the sign-in dialog the moment it succeeds, and
   * the effect below for anyone who arrives already signed in. Whichever comes
   * second finds the first already running and leaves it to it.
   *
   * What is happening is kept in the store, not here. Every page is readable
   * the instant the session exists; rendering and banking the whole book
   * takes longer and happens behind them, usually across the move from the
   * editor to the finish step, which is a second mount of this component. A
   * failure reported to the first mount's state was never seen.
   */
  const runClaim = useCallback((): void => {
    const start = useOurTailTalesStore.getState();
    if (start.pages.length === 0 || start.claimedAt) return;
    if (claimStarting || start.claim?.phase === "saving") return;
    claimStarting = true;

    void (async () => {
      let draftId: string | null = null;
      let outcome: ClaimOutcome = "failed";
      try {
        // A book that has never been written to this browser has no id yet,
        // and the id is what the save is recorded against. One local save
        // gives it one. With an id already there, nothing is awaited before
        // the store is told, so a second caller cannot slip in between.
        if (!useOurTailTalesStore.getState().localDraftId) await save();
        draftId = useOurTailTalesStore.getState().localDraftId;
        if (!draftId) throw new Error("The book has no local draft to save.");

        useOurTailTalesStore.getState().beginClaim(draftId);
        claimStarting = false;
        outcome = await claimBook(draftId);
      } catch (error) {
        captureClientException(error);
        outcome = "failed";
      }
      claimStarting = false;
      if (draftId) {
        useOurTailTalesStore.getState().endClaim(draftId, outcome);
      } else {
        // Never got as far as the store. This mount is all there is to tell.
        setNotice(CLAIM_FAILED_NOTICE);
      }
    })();
  }, [claimBook, save]);

  const handleAuthenticated = useCallback(() => {
    setAuthOpen(false);
    // They signed in from this book, on purpose, so it is saved to the
    // account they chose even if the book was made under another address.
    runClaim();
  }, [runClaim]);

  /**
   * A session and a finished book that was never saved to it: save it now.
   *
   * Saving used to happen only in the callback of the sign-in dialog. Anyone
   * who signed in somewhere else (the page the welcome email links to, a
   * confirmation link, a password reset) arrived here signed in with their
   * book on screen and nothing ever kept it, so it still expired.
   *
   * It reacts to the book, not only to arriving: a book made while already
   * signed in reaches the editor long after this first ran. And it is once
   * per book, by the book's own id, so a second book made after starting
   * over is saved as well. `shouldAutoClaim` has the rest of the rules,
   * including whose book it has to be.
   *
   * With no local book there is nothing to save and the normal start shows:
   * that is what another device looks like, since photos never leave the
   * browser that made the book.
   */
  const {
    funnelState,
    leadEmail,
    localDraftId,
    claimedAt,
    claim,
    claimAttemptedFor,
  } = store;
  const pageCount = store.pages.length;
  useEffect(() => {
    if (!localReady || !isAuthenticated) return;
    // A save for another book is still finishing. This runs again when it
    // ends, because `claim` changes.
    if (claim?.phase === "saving") return;
    if (
      !shouldAutoClaim({
        sessionEmail,
        leadEmail,
        funnelState,
        pageCount,
        draftId: localDraftId,
        claimedAt,
        attemptedFor: [...claimAttemptedFor, ...exhaustedPartialClaims()],
      })
    ) {
      return;
    }
    runClaim();
  }, [
    localReady,
    isAuthenticated,
    sessionEmail,
    leadEmail,
    funnelState,
    pageCount,
    localDraftId,
    claimedAt,
    claim,
    claimAttemptedFor,
    runClaim,
  ]);

  // Derived from the store rather than set as a notice: it shows on whichever
  // mount is on screen, only for the book it is about, and ending the save
  // cannot wipe an unrelated notice that arrived while it ran.
  const claimNotice =
    claim && claim.draftId === localDraftId
      ? claim.phase === "saving"
        ? CLAIM_SAVING_NOTICE
        : CLAIM_FAILED_NOTICE
      : null;

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

    // With Video Memories off, anything a draft still holds is treated as
    // absent: no readiness gate, no codes in the print file, and no call to
    // `/api/orders/freeze`, which `prepareOrder` only makes for placements.
    const placements = videoMemoriesEnabled ? state.placements : [];

    try {
      if (placements.length > 0 && (!state.draftId || !state.draftSecret)) {
        throw new Error(
          "Your Video Memories could not be saved. Please try again.",
        );
      }
      if (!placedMemoriesReadyForCheckout(placements, state.videoAssets)) {
        throw new Error(
          "Every placed Video Memory must be ready before checkout. Unused videos can keep preparing.",
        );
      }

      // The clean PDF comes with the hardcover. It is banked onto the draft
      // this order is tied to, and whichever of the payment webhook and the
      // order page sees it first unlocks it.
      //
      // The draft is settled first, because the order has to name the same
      // one the bank writes to. The bank itself then runs beside the order
      // rather than ahead of it: it renders the whole book a second time, and
      // nobody should wait on that to reach checkout. Best effort throughout.
      // A failure here costs the PDF copy, never the printed book.
      let draftId = state.draftId;
      let draftSecret = state.draftSecret;
      if (placements.length === 0) {
        try {
          // The button goes busy before the first wait, so a second tap
          // cannot start a second order.
          state.setExporting("Setting up your order…");
          const draft = await ensureDraft(state.leadEmail);
          draftId = draft.draftId;
          draftSecret = draft.secret;
          // Not awaited, here or below. It carries on after the move to the
          // checkout page, and it reports its own failure.
          void bankCleanBookForOrder().catch((bankError: unknown) => {
            captureClientException(bankError);
          });
        } catch (draftError) {
          captureClientException(draftError);
        }
      }

      const { orderId, orderToken } = await prepareOrder({
        meta: state.meta,
        chapters: state.chapters,
        pages: state.pages,
        chapterCount: state.chapterCount,
        photos: photoMapOf(state.photos),
        email: state.leadEmail,
        draftId,
        draftSecret,
        placements,
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
  }, [router, videoMemoriesEnabled]);

  // A failed confirmation link lands back here with ?authError=. Derived
  // rather than stored: the parameter was previously set by the auth callback
  // and read by nothing, so a broken link looked exactly like a working one.
  const authErrorNotice = searchParams.get("authError")
    ? "That sign-in link did not work. It may have already been used or expired. You can sign in again from your book."
    : null;

  /**
   * Whichever address this page was asked for follows the customer between
   * the two steps, so the editor and the price list read the same book.
   */
  const withEmail = useCallback(
    (path: string): string =>
      emailParam ? `${path}?email=${encodeURIComponent(emailParam)}` : path,
    [emailParam],
  );

  const goFinish = useCallback(() => {
    const state = useOurTailTalesStore.getState();
    track("book_finished", {
      chapters: state.chapterCount,
      price: bookSpec(state.chapterCount).price,
    });
    // The teaser banked its draft id/secret to storage the moment the story
    // was written, but that never reaches this session's live state on its
    // own — only a page load re-reads storage. Without this, the clean-PDF
    // button on the finish screen is missing until the customer refreshes.
    if (!state.draftId || !state.draftSecret) {
      useOurTailTalesStore.getState().hydrateDraft();
    }
    router.push(withEmail("/create/finish"));
  }, [router, withEmail]);

  /**
   * Nothing to finish.
   *
   * Somebody who types the address, reloads after starting over, or follows a
   * stale link lands on a price list for a book that does not exist. There is
   * exactly one thing they can do next, so it is done for them rather than
   * shown to them as an empty screen.
   */
  const nothingToFinish = step === "finish" && localReady && store.pages.length === 0;
  useEffect(() => {
    if (!nothingToFinish) return;
    router.replace(withEmail("/create"));
  }, [nothingToFinish, router, withEmail]);

  const stage = !localReady || nothingToFinish ? (
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
      finishing={step === "finish"}
      onFinish={goFinish}
      onKeepEditing={() => router.push(withEmail("/create"))}
      unlocked={unlocked}
      downloading={downloadingPdf}
      notice={notice ?? claimNotice ?? authErrorNotice}
    />
  );

  return (
    <VideoMemoriesFlagProvider enabled={videoMemoriesEnabled}>
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
    </VideoMemoriesFlagProvider>
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

/**
 * The titles and page captions every other chapter has already settled on,
 * read live off the store rather than accumulated as the run goes — two
 * chapters are being written at once, and a snapshot taken when the run
 * started would miss whatever either of them has finished since.
 */
function usedPhrasesSoFar(excludingChapterId: string): {
  titles: string[];
  captions: string[];
} {
  const chapters = useOurTailTalesStore
    .getState()
    .chapters.filter((chapter) => chapter.id !== excludingChapterId && chapter.aiStatus === "done");
  return {
    titles: chapters.map((chapter) => chapter.title).filter((title) => title.trim()),
    captions: chapters
      .flatMap((chapter) => chapter.pagePlan ?? [])
      .map((page) => page.caption)
      .filter((caption): caption is string => Boolean(caption?.trim())),
  };
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
