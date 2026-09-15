"use client";

import { create } from "zustand";

import { proposeChapters } from "@/lib/photo/cluster";
import { groupDuplicates, selectablePhotos } from "@/lib/photo/dedupe";
import { paginateBook } from "@/lib/book/pagination";
import * as assetStore from "@/lib/photo/assetStore";
import {
  releaseAllVideoPosters,
  releaseVideoPoster,
} from "@/lib/photo/videoPreview";
import {
  maxSupportedChapters,
  recommendedChapters,
  BASE_CHAPTERS,
} from "@/lib/pricing";
import type { BookMeta, BookPage, Chapter, PlaceLabel } from "@/types/book";
import type { StoryDraft } from "@/types/story";
import type {
  PhotoAsset,
  ProcessedPhoto,
  ProcessingPhase,
  ProcessingProgressState,
} from "@/types/photo";
import type { VideoAsset, VideoMemoryPlacement } from "@/types/video-memory";
import { loadStoredDraft } from "@/lib/video-memory/client";

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
  albumVideos: AlbumVideoPreview[];
};

export type AlbumVideoPreview = {
  id: string;
  posterUrl: string;
  previewUrl: string;
  fileName: string;
};

type Actions = {
  startProcessing: (total: number) => void;
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

  setLeadEmail: (email: string) => void;
  setExporting: (message: string | null) => void;
  goToEditing: () => void;
  setDraft: (draftId: string, draftSecret: string) => void;
  setVideoLibrary: (
    assets: VideoAsset[],
    placements: VideoMemoryPlacement[],
  ) => void;
  setVideoNotice: (message: string | null) => void;
  addAlbumVideos: (videos: AlbumVideoPreview[]) => void;
  removeAlbumPhoto: (id: string) => void;
  removeAlbumVideo: (id: string) => void;
  hydrateDraft: () => void;
  reset: () => void;
};

export type OurTailTalesStore = State & Actions;

const emptyProgress: ProcessingProgressState = {
  processed: 0,
  total: 0,
  phase: "reading",
  failed: 0,
};

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
  videoAssets: [],
  placements: [],
  videoNotice: null,
  albumVideos: [],
};

export const useOurTailTalesStore = create<OurTailTalesStore>((set) => ({
  ...initialState,

  startProcessing: (total) =>
    set((state) => ({
      funnelState:
        state.photos.length > 0 && state.funnelState !== "idle"
          ? state.funnelState
          : "processing",
      progress: { processed: 0, total, phase: "reading", failed: 0 },
      processingError: null,
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
          ...state.progress,
          processed: state.progress.processed + batch.length,
        },
      };
    }),

  noteFailures: (count) =>
    set((state) => ({
      progress: { ...state.progress, failed: state.progress.failed + count },
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

  cancelProcessing: () => {
    assetStore.releaseAll();
    releaseAllVideoPosters();
    const stored = loadStoredDraft();
    set({
      ...initialState,
      draftId: stored?.draftId ?? null,
      draftSecret: stored?.secret ?? null,
    });
  },

  setMeta: (patch) => set((state) => ({ meta: { ...state.meta, ...patch } })),

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
        pages: paginateBook(meta, chapters, orientationsOf(state.photos)),
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
    set((state) => ({
      chapters: state.chapters.map((chapter) =>
        chapter.id === chapterId
          ? {
              ...chapter,
              title: story.title || chapter.title,
              dateLabel: story.dateLabel || chapter.dateLabel,
              blurb: story.blurb || chapter.blurb,
              aiStatus: "done",
              aiError: undefined,
            }
          : chapter,
      ),
    })),

  setChapterPlaces: (chapterId, places) =>
    set((state) => ({
      chapters: state.chapters.map((chapter) =>
        chapter.id === chapterId ? { ...chapter, places } : chapter,
      ),
    })),

  finishStoryGeneration: () => set({ funnelState: "editing" }),

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
        pages: paginateBook(state.meta, chapters, orientationsOf(state.photos)),
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
        pages: paginateBook(state.meta, chapters, orientationsOf(state.photos)),
      };
    }),

  setCoverPhoto: (photoId) =>
    set((state) => {
      const meta = { ...state.meta, coverPhotoId: photoId };
      return {
        meta,
        pages: paginateBook(meta, state.chapters, orientationsOf(state.photos)),
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
      return {
        photos,
        meta:
          state.meta.coverPhotoId === id
            ? { ...state.meta, coverPhotoId: null }
            : state.meta,
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

  hydrateDraft: () => {
    const stored = loadStoredDraft();
    if (!stored) return;
    set({ draftId: stored.draftId, draftSecret: stored.secret });
  },

  reset: () => {
    assetStore.releaseAll();
    releaseAllVideoPosters();
    const stored = loadStoredDraft();
    set({
      ...initialState,
      draftId: stored?.draftId ?? null,
      draftSecret: stored?.secret ?? null,
    });
  },
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
export function selectHasUnsavedWork(state: OurTailTalesStore): boolean {
  return state.funnelState !== "idle" && state.photos.length > 0;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function orientationsOf(photos: PhotoAsset[]) {
  return new Map(photos.map((photo) => [photo.id, photo.orientation]));
}
