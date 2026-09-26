"use client";

import { create } from "zustand";

import { proposeChapters } from "@/lib/photo/cluster";
import { groupDuplicates, selectablePhotos } from "@/lib/photo/dedupe";
import {
  addPhotosToPage as placeOnPage,
  applyPageLayout,
  applyPageNote,
  hasDedication,
  paginateBook,
  photoPageIndex,
  withoutEmptyDedication,
  type PhotoLookup,
} from "@/lib/book/pagination";
import { isPhotoLayout } from "@/lib/book/layouts";
import { planFromIndexes } from "@/lib/book/page-plan";
import { chapterBodyIds } from "@/lib/story/client";
import * as assetStore from "@/lib/photo/assetStore";
import { clearCustomCoverFile } from "@/lib/book/customCoverStore";
import {
  releaseAllVideoPosters,
  releaseVideoPoster,
} from "@/lib/photo/videoPreview";
import {
  maxSupportedChapters,
  recommendedChapters,
  BASE_CHAPTERS,
} from "@/lib/pricing";
import type {
  BookMeta,
  BookPage,
  Chapter,
  CustomCoverMeta,
  PhotoLayoutId,
  PlaceLabel,
} from "@/types/book";
import type { StoryDraft } from "@/types/story";
import type {
  PhotoAsset,
  ProcessedPhoto,
  ProcessingPhase,
  ProcessingProgressState,
} from "@/types/photo";
import type { VideoAsset, VideoMemoryPlacement } from "@/types/video-memory";
import { loadStoredDraft } from "@/lib/video-memory/client";
import { clearLocalDraft, restoreLocalDraft } from "@/lib/drafts/local";

export type FunnelState =
  | "idle"
  | "processing"
  | "album_ready"
  | "configure"
  | "organizing"
  | "ai_generating"
  | "editing"
  | "exporting";

type State = {
  funnelState: FunnelState;
  photos: PhotoAsset[];
  progress: ProcessingProgressState;
  processingError: string | null;
  meta: BookMeta;
  chapterCount: number;
  chapters: Chapter[];
  pages: BookPage[];
  leadEmail: string | null;
  exportMessage: string | null;
  draftId: string | null;
  draftSecret: string | null;
  videoAssets: VideoAsset[];
  placements: VideoMemoryPlacement[];
  videoNotice: string | null;
  /** A page the editor should turn to, once it can. */
  revealPageId: string | null;
  albumVideos: AlbumVideoPreview[];
  freePreviewReady: boolean;
  /** Shareable link to the banked free preview, once it has been uploaded. */
  bookUrl: string | null;
  /** When the banked free preview stops being kept, or null once there's an account. */
  bookExpiresAt: Date | null;
  /** Local-draft save state, shown in the header as a saved/saving indicator. */
  saveStatus: "saved" | "saving" | "error";
  /** Customer-uploaded print-ready cover, used instead of the designed one when set. */
  customCover: CustomCoverMeta | null;
  /**
   * The book exactly as it was written, kept so every edit is undoable in one
   * step. The fear of ruining something they already love is the main reason
   * people back out of an editor; a way back makes the whole thing safe to
   * touch. Captured once, when generation finishes, and never overwritten.
   */
  originalBook: BookSnapshot | null;
};

export type BookSnapshot = {
  meta: BookMeta;
  chapters: Chapter[];
  pages: BookPage[];
};

export type AlbumVideoPreview = {
  id: string;
  posterUrl: string;
  previewUrl: string;
  fileName: string;
};

type Actions = {
  startProcessing: (total: number) => void;
  advanceProcessing: (count?: number) => void;
  setProgressPhase: (phase: ProcessingPhase) => void;
  addProcessedPhotos: (batch: ProcessedPhoto[]) => void;
  noteFailures: (count: number) => void;
  finishProcessing: () => void;
  failProcessing: (message: string) => void;
  cancelProcessing: () => void;

  setMeta: (patch: Partial<BookMeta>) => void;
  goToConfigure: () => void;
  setChapterCount: (count: number) => void;
  confirmBookSize: () => void;

  beginStoryGeneration: () => void;
  setChapterAiStatus: (
    chapterId: string,
    status: Chapter["aiStatus"],
    error?: string,
  ) => void;
  applyChapterStory: (chapterId: string, story: StoryDraft) => void;
  setChapterPlaces: (chapterId: string, places: PlaceLabel[]) => void;
  finishStoryGeneration: () => void;

  updateChapterText: (
    chapterId: string,
    patch: Partial<Pick<Chapter, "title" | "blurb" | "dateLabel">>,
  ) => void;
  swapChapterPhoto: (
    chapterId: string,
    outgoingId: string,
    incomingId: string,
  ) => void;
  reorderChapterPhoto: (
    chapterId: string,
    photoId: string,
    toIndex: number,
  ) => void;
  setCoverPhoto: (photoId: string) => void;
  setChapterHero: (chapterId: string, photoId: string) => void;
  /**
   * Gives one of a chapter's photo pages a layout from the design's
   * catalogue, or hands it back to the book with `null`.
   */
  setPageLayout: (
    chapterId: string,
    pageIndex: number,
    layoutId: PhotoLayoutId | null,
  ) => void;
  /**
   * Puts photographs that have just been added onto one of a chapter's pages,
   * growing its layout to fit them and sending the rest to the pages after it.
   */
  addPhotosToPage: (
    chapterId: string,
    pageIndex: number,
    photoIds: string[],
  ) => void;
  /**
   * Asks the editor to turn to a page. Cleared by whoever turns to it, so a
   * page that has just been made or just been filled can be shown without the
   * editor and the panel inside it having to know about each other.
   */
  revealPage: (pageId: string | null) => void;
  /**
   * The owner's words for one of a chapter's photo pages. Empty text clears
   * the note and the page falls back to its own date.
   */
  setPageNote: (
    chapterId: string,
    pageIndex: number,
    slot: number,
    text: string,
  ) => void;

  setLeadEmail: (email: string) => void;
  setExporting: (message: string | null) => void;
  goToEditing: () => void;
  setDraft: (draftId: string, draftSecret: string) => void;
  setBookUrl: (bookUrl: string | null) => void;
  setBookExpiresAt: (bookExpiresAt: Date | null) => void;
  setVideoLibrary: (
    assets: VideoAsset[],
    placements: VideoMemoryPlacement[],
  ) => void;
  setVideoNotice: (message: string | null) => void;
  addAlbumVideos: (videos: AlbumVideoPreview[]) => void;
  removeAlbumPhoto: (id: string) => void;
  removeAlbumVideo: (id: string) => void;
  hydrateDraft: () => void;
  restoreLocalBook: (knownEmail?: string | null) => Promise<boolean>;
  setFreePreviewReady: (ready: boolean) => void;
  setSaveStatus: (status: "saved" | "saving" | "error") => void;
  setCustomCover: (customCover: CustomCoverMeta | null) => void;
  setOriginalBook: (snapshot: BookSnapshot | null) => void;
  resetToOriginal: () => void;
  reset: () => void;
};

export type OurTailTalesStore = State & Actions;

const emptyProgress: ProcessingProgressState = {
  processed: 0,
  total: 0,
  phase: "reading",
  failed: 0,
  startedAt: 0,
};

export function beginBatchProgress(
  total: number,
  startedAt = Date.now(),
): ProcessingProgressState {
  return {
    processed: 0,
    total: Math.max(0, total),
    phase: "reading",
    failed: 0,
    startedAt,
  };
}

/**
 * How much longer this album has, in seconds, or null while it is too early
 * to say.
 *
 * A bar creeping across with no numbers on it is the same picture whether an
 * album has thirty photographs or four thousand, and four thousand is the
 * album this has to be honest about. Measured from what has actually been read
 * so far rather than from a guess at what a photograph costs, and withheld
 * until enough have gone through to mean anything.
 */
export function secondsRemaining(
  progress: ProcessingProgressState,
  now = Date.now(),
): number | null {
  const done = progress.processed;
  const left = progress.total - done;
  if (done < 8 || left <= 0) return null;
  const elapsed = now - progress.startedAt;
  if (elapsed <= 0) return null;
  return Math.max(1, Math.round((elapsed / done) * left) / 1000);
}

export function advanceBatchProgress(
  progress: ProcessingProgressState,
  count = 1,
  failed = 0,
): ProcessingProgressState {
  const completed = Math.max(0, count);
  return {
    ...progress,
    processed: Math.min(progress.total, progress.processed + completed),
    failed: progress.failed + Math.max(0, failed),
  };
}

const emptyMeta: BookMeta = {
  petName: "",
  birthYear: "",
  deathYear: "",
  dedication: "",
  coverPhotoId: null,
};

const initialState: State = {
  funnelState: "idle",
  photos: [],
  progress: emptyProgress,
  processingError: null,
  meta: emptyMeta,
  chapterCount: BASE_CHAPTERS,
  chapters: [],
  pages: [],
  leadEmail: null,
  exportMessage: null,
  draftId: null,
  draftSecret: null,
  bookUrl: null,
  bookExpiresAt: null,
  videoAssets: [],
  placements: [],
  videoNotice: null,
  revealPageId: null,
  albumVideos: [],
  freePreviewReady: false,
  saveStatus: "saved",
  customCover: null,
  originalBook: null,
};

export const useOurTailTalesStore = create<OurTailTalesStore>((set, get) => ({
  ...initialState,

  startProcessing: (total) =>
    set(() => ({
      funnelState: "processing",
      progress: beginBatchProgress(total),
      processingError: null,
    })),

  advanceProcessing: (count = 1) =>
    set((state) => ({
      progress: advanceBatchProgress(state.progress, count),
    })),

  setProgressPhase: (phase) =>
    set((state) => ({ progress: { ...state.progress, phase } })),

  addProcessedPhotos: (batch) =>
    set((state) => {
      // Listed field by field on purpose: the thumbnail Blob stays in the asset
      // store and must never enter React render state.
      const added: PhotoAsset[] = batch.map((processed) => ({
        id: processed.id,
        fileName: processed.fileName,
        fileSize: processed.fileSize,
        capturedAt: processed.capturedAt,
        dateSource: processed.dateSource,
        lat: processed.lat,
        lng: processed.lng,
        width: processed.width,
        height: processed.height,
        orientation: processed.orientation,
        qualityScore: processed.qualityScore,
        dHash: processed.dHash,
        fingerprint: processed.fingerprint,
        usable: processed.usable,
        isDuplicate: false,
        thumbUrl: assetStore.getThumbUrl(processed.id) ?? "",
      }));

      return {
        photos: [...state.photos, ...added],
        progress: {
          ...advanceBatchProgress(state.progress, batch.length),
        },
      };
    }),

  noteFailures: (count) =>
    set((state) => ({
      progress: advanceBatchProgress(state.progress, count, count),
    })),

  finishProcessing: () =>
    set((state) => {
      const deduped = groupDuplicates(state.photos);
      const usable = selectablePhotos(deduped).length;
      return {
        photos: deduped,
        chapterCount: recommendedChapters(usable),
        progress: { ...state.progress, phase: "done" },
        funnelState: "album_ready",
      };
    }),

  failProcessing: (message) =>
    set({ processingError: message, funnelState: "idle" }),

  cancelProcessing: () =>
    set((state) => {
      assetStore.releaseAll();
      releaseAllVideoPosters();
      clearCustomCoverFile();
      const stored = loadStoredDraft(state.leadEmail);
      return {
        ...initialState,
        leadEmail: state.leadEmail,
        draftId: stored?.draftId ?? null,
        draftSecret: stored?.secret ?? null,
      };
    }),

  setMeta: (patch) =>
    set((state) => {
      const meta = { ...state.meta, ...patch };
      // A dedication appearing or disappearing adds or removes its page. Any
      // other edit leaves the page list alone, so layouts the customer chose
      // are not re-dealt on every keystroke.
      if (
        state.pages.length === 0 ||
        hasDedication(meta) === hasDedication(state.meta)
      ) {
        return { meta };
      }
      return {
        meta,
        pages: paginateBook(meta, state.chapters, photoFactsOf(state.photos)),
      };
    }),

  goToConfigure: () => set({ funnelState: "configure" }),

  setChapterCount: (count) =>
    set((state) => {
      const supported = maxSupportedChapters(
        selectablePhotos(state.photos).length,
      );
      return { chapterCount: Math.min(Math.max(count, BASE_CHAPTERS), supported) };
    }),

  confirmBookSize: () =>
    set((state) => {
      const chapters = proposeChapters(state.photos, state.chapterCount);
      const coverPhotoId =
        state.meta.coverPhotoId ?? chapters[0]?.heroPhotoId ?? null;
      const meta = { ...state.meta, coverPhotoId };
      return {
        chapters,
        meta,
        pages: paginateBook(meta, chapters, photoFactsOf(state.photos)),
        funnelState: "organizing",
      };
    }),

  beginStoryGeneration: () =>
    set((state) => ({
      funnelState: "ai_generating",
      chapters: state.chapters.map((chapter) => ({
        ...chapter,
        aiStatus: chapter.aiStatus === "done" ? "done" : "pending",
        aiError: undefined,
      })),
    })),

  setChapterAiStatus: (chapterId, status, error) =>
    set((state) => ({
      chapters: state.chapters.map((chapter) =>
        chapter.id === chapterId
          ? { ...chapter, aiStatus: status, aiError: error }
          : chapter,
      ),
    })),

  applyChapterStory: (chapterId, story) =>
    set((state) => {
      const chapters = state.chapters.map((chapter) => {
        if (chapter.id !== chapterId) return chapter;
        // The model laid the chapter's pages out and captioned them as well
        // as writing it. Anything unusable leaves the chapter with the
        // grouping it was created with, never without one.
        const planned = planFromIndexes(chapterBodyIds(chapter), story.pages);
        return {
          ...chapter,
          title: story.title || chapter.title,
          dateLabel: story.dateLabel || chapter.dateLabel,
          blurb: story.blurb || chapter.blurb,
          pagePlan: planned ?? chapter.pagePlan,
          aiStatus: "done" as const,
          aiError: undefined,
        };
      });
      return {
        chapters,
        pages: paginateBook(state.meta, chapters, photoFactsOf(state.photos)),
      };
    }),

  setChapterPlaces: (chapterId, places) =>
    set((state) => ({
      chapters: state.chapters.map((chapter) =>
        chapter.id === chapterId ? { ...chapter, places } : chapter,
      ),
    })),

  finishStoryGeneration: () =>
    set((state) => ({
      funnelState: "editing",
      // The way back. Taken at the last moment the book is purely what we
      // wrote, because everything after it is the customer's own.
      //
      // Kept if it already exists. This runs again whenever generation is
      // re-entered — a draft restored mid-write, one failed chapter retried —
      // and re-taking it there would snapshot a book the customer has already
      // edited, so "reset to original" would quietly restore their edits
      // instead of undoing them.
      // Not taken at all until every chapter is written. A first pass that
      // left one chapter failed used to be snapshotted as it stood, and since
      // it is never retaken, a successful retry afterwards meant "reset to
      // original" walked the customer back to a book with a hole in it and
      // threw away the retry.
      originalBook:
        state.originalBook ??
        (state.chapters.length > 0 &&
        state.chapters.every((chapter) => chapter.aiStatus === "done")
          ? {
              meta: structuredClone(state.meta),
              chapters: structuredClone(state.chapters),
              pages: structuredClone(state.pages),
            }
          : null),
    })),

  updateChapterText: (chapterId, patch) =>
    set((state) => ({
      chapters: state.chapters.map((chapter) =>
        chapter.id === chapterId ? { ...chapter, ...patch } : chapter,
      ),
    })),

  swapChapterPhoto: (chapterId, outgoingId, incomingId) =>
    set((state) => {
      const chapters = state.chapters.map((chapter) => {
        if (chapter.id !== chapterId) return chapter;
        if (chapter.photoIds.includes(incomingId)) return chapter;
        const photoIds = chapter.photoIds.map((id) =>
          id === outgoingId ? incomingId : id,
        );
        const heroPhotoId =
          chapter.heroPhotoId === outgoingId ? incomingId : chapter.heroPhotoId;
        return { ...chapter, photoIds, heroPhotoId };
      });
      return {
        chapters,
        pages: paginateBook(state.meta, chapters, photoFactsOf(state.photos)),
      };
    }),

  reorderChapterPhoto: (chapterId, photoId, toIndex) =>
    set((state) => {
      const chapters = state.chapters.map((chapter) => {
        if (chapter.id !== chapterId) return chapter;
        const from = chapter.photoIds.indexOf(photoId);
        if (from === -1) return chapter;
        const photoIds = [...chapter.photoIds];
        photoIds.splice(from, 1);
        photoIds.splice(clamp(toIndex, 0, photoIds.length), 0, photoId);
        return { ...chapter, photoIds };
      });
      return {
        chapters,
        pages: paginateBook(state.meta, chapters, photoFactsOf(state.photos)),
      };
    }),

  setCoverPhoto: (photoId) =>
    set((state) => {
      const meta = { ...state.meta, coverPhotoId: photoId };
      return {
        meta,
        pages: paginateBook(meta, state.chapters, photoFactsOf(state.photos)),
      };
    }),

  /**
   * Which of a chapter's photos opens it. Distinct from swapping a photo: the
   * picture is already in the chapter, it just moves to the opener's full-page
   * slot, so the page list has to be rebuilt around it.
   */
  setChapterHero: (chapterId, photoId) =>
    set((state) => {
      const chapters = state.chapters.map((chapter) =>
        chapter.id === chapterId && chapter.photoIds.includes(photoId)
          ? { ...chapter, heroPhotoId: photoId }
          : chapter,
      );
      return {
        chapters,
        pages: paginateBook(state.meta, chapters, photoFactsOf(state.photos)),
      };
    }),

  setPageLayout: (chapterId, pageIndex, layoutId) =>
    set((state) => {
      const chapters = state.chapters.map((chapter) =>
        chapter.id === chapterId
          ? applyPageLayout(chapter, pageIndex, layoutId)
          : chapter,
      );
      return {
        chapters,
        pages: paginateBook(state.meta, chapters, photoFactsOf(state.photos)),
      };
    }),

  addPhotosToPage: (chapterId, pageIndex, photoIds) =>
    set((state) => {
      const page = state.pages.find(
        (entry) =>
          entry.chapterId === chapterId && photoPageIndex(entry) === pageIndex,
      );
      const target = state.chapters.find((entry) => entry.id === chapterId);
      if (!target) return {};

      const { chapter } = placeOnPage(target, pageIndex, photoIds, {
        photoIds: page?.photoIds ?? [],
        layoutId: isPhotoLayout(page?.layoutId) ? page.layoutId : null,
      });
      const chapters = state.chapters.map((entry) =>
        entry.id === chapterId ? chapter : entry,
      );
      const pages = paginateBook(state.meta, chapters, photoFactsOf(state.photos));

      // Wherever the last of them ended up is where the customer should be
      // looking: the page they were on if it had room, and the page the book
      // just made if it did not.
      const landed = photoIds.at(-1);
      const reveal = landed
        ? (pages.find((entry) => entry.photoIds.includes(landed))?.id ?? null)
        : null;

      return { chapters, pages, revealPageId: reveal };
    }),

  revealPage: (pageId) => set({ revealPageId: pageId }),

  setPageNote: (chapterId, pageIndex, slot, text) =>
    set((state) => {
      const chapters = state.chapters.map((chapter) =>
        chapter.id === chapterId
          ? applyPageNote(chapter, pageIndex, slot, text)
          : chapter,
      );
      return {
        chapters,
        pages: paginateBook(state.meta, chapters, photoFactsOf(state.photos)),
      };
    }),

  setLeadEmail: (email) => set({ leadEmail: email }),

  setExporting: (message) =>
    set((state) => ({
      exportMessage: message,
      funnelState: message ? "exporting" : state.funnelState,
    })),

  goToEditing: () => set({ funnelState: "editing" }),

  setDraft: (draftId, draftSecret) => set({ draftId, draftSecret }),

  setBookUrl: (bookUrl) => set({ bookUrl }),

  setBookExpiresAt: (bookExpiresAt) => set({ bookExpiresAt }),

  setVideoLibrary: (videoAssets, placements) =>
    set({ videoAssets, placements }),

  setVideoNotice: (videoNotice) => set({ videoNotice }),

  addAlbumVideos: (videos) =>
    set((state) => ({ albumVideos: [...state.albumVideos, ...videos] })),

  removeAlbumPhoto: (id) =>
    set((state) => {
      assetStore.releaseAsset(id);
      const photos = state.photos.filter((photo) => photo.id !== id);
      const empty = photos.length === 0 && state.albumVideos.length === 0;
      const meta =
        state.meta.coverPhotoId === id
          ? { ...state.meta, coverPhotoId: null }
          : state.meta;
      // A photograph that has left the album has left the book with it. This
      // used to take it out of the album alone, which was harmless while the
      // only way to remove one was from the album step — but the editor can
      // remove a photograph that is on a page, and a chapter still pointing
      // at a released asset prints a hole where the picture was. The page
      // plan needs no help: `reconcilePlan` drops what is no longer there.
      const chapters = state.chapters.map((chapter) =>
        chapter.photoIds.includes(id) ||
        chapter.candidateIds.includes(id) ||
        chapter.heroPhotoId === id
          ? {
              ...chapter,
              photoIds: chapter.photoIds.filter((photoId) => photoId !== id),
              candidateIds: chapter.candidateIds.filter((photoId) => photoId !== id),
              heroPhotoId: chapter.heroPhotoId === id ? null : chapter.heroPhotoId,
            }
          : chapter,
      );
      return {
        photos,
        meta,
        chapters,
        // Before there is a book there is nothing to repaginate, and building
        // pages here would conjure one out of an album still being gathered.
        ...(state.chapters.length > 0
          ? { pages: paginateBook(meta, chapters, photoFactsOf(photos)) }
          : {}),
        funnelState:
          empty && state.funnelState === "album_ready"
            ? "idle"
            : state.funnelState,
      };
    }),

  removeAlbumVideo: (id) =>
    set((state) => {
      releaseVideoPoster(id);
      const albumVideos = state.albumVideos.filter((video) => video.id !== id);
      const empty = state.photos.length === 0 && albumVideos.length === 0;
      return {
        albumVideos,
        funnelState:
          empty && state.funnelState === "album_ready"
            ? "idle"
            : state.funnelState,
      };
    }),

  hydrateDraft: () =>
    set((state) => {
      const stored = loadStoredDraft(state.leadEmail);
      if (!stored) return {};
      return { draftId: stored.draftId, draftSecret: stored.secret };
    }),

  /**
   * Loads the book belonging to this address, and only that one.
   *
   * The miss case is the important one. This store lives for as long as the
   * tab does, so arriving from the landing page with a second address used to
   * find nothing, return early, and leave the first person's book sitting in
   * memory — the new visitor was shown someone else's pet. Finding nothing now
   * clears everything instead, which is the honest answer to "show me this
   * address's book" when there isn't one.
   */
  restoreLocalBook: async (knownEmail) => {
    let restored: Awaited<ReturnType<typeof restoreLocalDraft>>;
    try {
      restored = await restoreLocalDraft(knownEmail);
    } catch (error) {
      // Storage refused to answer. That is not the same as "this address has
      // no book", and treating it as one is how an intact record gets thrown
      // away: the screen is cleared, the next save mints a fresh id, and it
      // writes straight over the book that was there all along.
      console.error("[ourTailTales] Local draft could not be read", error);

      const asking = knownEmail?.trim().toLowerCase() || null;
      const holding = get().leadEmail?.trim().toLowerCase() || null;

      if (asking !== holding) {
        // Except here. We cannot show one person's pet to another while we
        // work out whether the database is well, so privacy wins over the
        // book and the screen starts empty.
        assetStore.releaseAll();
        releaseAllVideoPosters();
        clearCustomCoverFile();
        set({
          ...initialState,
          leadEmail: knownEmail?.trim() || null,
          saveStatus: "error",
        });
        return false;
      }

      // Same person, unreadable storage: leave their book on screen and say
      // plainly that it is not being saved.
      set({ saveStatus: "error" });
      return false;
    }

    if (!restored) {
      assetStore.releaseAll();
      releaseAllVideoPosters();
      clearCustomCoverFile();
      const stored = loadStoredDraft(knownEmail);
      set({
        ...initialState,
        leadEmail: knownEmail?.trim() || null,
        draftId: stored?.draftId ?? null,
        draftSecret: stored?.secret ?? null,
      });
      return false;
    }
    const stored = loadStoredDraft(restored.leadEmail ?? knownEmail);
    set({
      draftId: stored?.draftId ?? null,
      draftSecret: stored?.secret ?? null,
      funnelState: restored.funnelState,
      photos: restored.photos,
      progress: restored.progress,
      processingError: null,
      meta: restored.meta,
      chapterCount: restored.chapterCount,
      chapters: restored.chapters,
      pages: withoutEmptyDedication(restored.pages, restored.meta),
      leadEmail: restored.leadEmail,
      albumVideos: restored.albumVideos,
      freePreviewReady: Boolean(restored.previewPdf),
      saveStatus: "saved",
      customCover: restored.customCover ?? null,
      originalBook: restored.originalBook ?? null,
      bookExpiresAt: restored.bookExpiresAt
        ? new Date(restored.bookExpiresAt)
        : null,
      bookUrl: restored.bookUrl ?? null,
    });
    return true;
  },

  setFreePreviewReady: (freePreviewReady) => set({ freePreviewReady }),

  setSaveStatus: (saveStatus) => set({ saveStatus }),

  setCustomCover: (customCover) => set({ customCover }),

  setOriginalBook: (originalBook) => set({ originalBook }),

  resetToOriginal: () =>
    set((state) => {
      if (!state.originalBook) return {};
      return {
        meta: structuredClone(state.originalBook.meta),
        chapters: structuredClone(state.originalBook.chapters),
        pages: structuredClone(state.originalBook.pages),
      };
    }),

  reset: () =>
    set((state) => {
      assetStore.releaseAll();
      releaseAllVideoPosters();
      clearCustomCoverFile();
      void clearLocalDraft();
      const stored = loadStoredDraft(state.leadEmail);
      return {
        ...initialState,
        leadEmail: state.leadEmail,
        draftId: stored?.draftId ?? null,
        draftSecret: stored?.secret ?? null,
      };
    }),
}));

/* --------------------------------- derivations -------------------------------- */

/**
 * Plain functions rather than Zustand selectors: each returns a fresh object, so
 * components must memoize them against `photos` instead of subscribing directly.
 */

export type AlbumSummary = {
  total: number;
  placeable: number;
  duplicates: number;
  weak: number;
  approximateDates: boolean;
  withGps: number;
  firstAt: number | null;
  lastAt: number | null;
  maxChapters: number;
};

export function summarizeAlbum(photos: PhotoAsset[]): AlbumSummary {
  const placeable = photos.filter(
    (photo) => photo.usable && !photo.isDuplicate,
  );
  const dated = placeable
    .map((photo) => photo.capturedAt)
    .filter((value): value is number => value !== null)
    .sort((a, b) => a - b);

  return {
    total: photos.length,
    placeable: placeable.length,
    duplicates: photos.filter((photo) => photo.isDuplicate).length,
    weak: photos.filter((photo) => !photo.usable).length,
    approximateDates: photos.some((photo) => photo.dateSource !== "exif"),
    withGps: placeable.filter((photo) => photo.lat !== undefined).length,
    firstAt: dated.at(0) ?? null,
    lastAt: dated.at(-1) ?? null,
    maxChapters: maxSupportedChapters(placeable.length),
  };
}

export function photoMapOf(photos: PhotoAsset[]): Map<string, PhotoAsset> {
  return new Map(photos.map((photo) => [photo.id, photo]));
}

/** True once the customer has work that closing the tab would destroy. */
function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * What pagination needs from the album: which way each photograph faces, and
 * when and where it was taken — the facts that decide which photographs
 * belong on a page together.
 */
function photoFactsOf(photos: PhotoAsset[]): PhotoLookup {
  return new Map(
    photos.map((photo) => [
      photo.id,
      {
        orientation: photo.orientation,
        capturedAt: photo.capturedAt,
        lat: photo.lat,
        lng: photo.lng,
      },
    ]),
  );
}
