"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import {
  DURATION_TOO_LONG_MESSAGE,
  STORAGE_UNAVAILABLE_MESSAGE,
  sourceTooLargeMessage,
} from "@/lib/video-memory/config";
import {
  deleteVideoMemory,
  ensureDraft,
  fetchVideoLibrary,
  fetchVideoMemoryConfig,
  placeVideoMemory,
  readVideoDurationMs,
  removePlacementFromPage,
  renameVideoMemory,
  retryVideoMemory,
  updatePlacementPage,
  uploadVideoMemory,
  type StoredDraft,
  type VideoMemoryPublicConfig,
} from "@/lib/video-memory/client";
import { isAcceptableVideoDuration } from "@/lib/video-memory/duration";
import { includedUniqueVideoCount } from "@/lib/video-memory/count";
import { packMeterView, type PackMeterView } from "@/lib/video-memory/pack-meter";
import { wouldOpenNewPack } from "@/lib/video-memory/pricing";
import { useOurTailTalesStore } from "@/store/useOurTailTalesStore";
import type { VideoAsset, VideoMemoryPlacement } from "@/types/video-memory";

/** How often a library with work in flight asks what has finished. */
const POLL_MS = 4000;

/**
 * What has already been fetched this session.
 *
 * The page inspector is keyed by page, so it is thrown away and rebuilt every
 * time somebody turns a page — and the Videos tab with it. Fetching the
 * library and the limits on every mount would mean two requests per page turn
 * for a library that is already in the store, kept current by the refresh
 * after every change and by the poll while anything is processing.
 */
let cachedConfig: VideoMemoryPublicConfig | null = null;
let loadedForDraft: string | null = null;

export type VideoMemories = {
  assets: VideoAsset[];
  placements: VideoMemoryPlacement[];
  /** Null until the draft these belong to has been resolved. */
  draft: StoredDraft | null;
  config: VideoMemoryPublicConfig | null;
  notice: string | null;
  setNotice: (message: string | null) => void;
  busy: boolean;
  meter: PackMeterView;
  /** Unique videos with at least one code in the book — what the packs price. */
  uniquePlaced: number;
  /** True when giving this video its first code would open another pack. */
  opensNewPack: (assetId: string) => boolean;
  upload: (file: File) => Promise<void>;
  place: (assetId: string, pageId: string) => Promise<void>;
  movePlacement: (placementId: string, pageId: string) => Promise<void>;
  removePlacement: (placementId: string) => Promise<void>;
  removeAsset: (assetId: string) => Promise<void>;
  retry: (assetId: string) => Promise<void>;
  /** Renames locally as it is typed; call `saveTitle` when the field is left. */
  renameLocally: (assetId: string, title: string) => void;
  saveTitle: (assetId: string, title: string) => void;
};

/**
 * The customer's videos, and where their codes are printed.
 *
 * One copy of this for the whole editor: the library, the draft it belongs to,
 * what is still processing, and every change that can be made to it. Both the
 * per-page Videos tab and the whole-book panel on the finishing step run off
 * it, so a video placed in one is placed in the other, and the pack price is
 * counted once from the same placements.
 */
export function useVideoMemories(): VideoMemories {
  const draftId = useOurTailTalesStore((state) => state.draftId);
  const draftSecret = useOurTailTalesStore((state) => state.draftSecret);
  const assets = useOurTailTalesStore((state) => state.videoAssets);
  const placements = useOurTailTalesStore((state) => state.placements);
  const notice = useOurTailTalesStore((state) => state.videoNotice);
  const setDraft = useOurTailTalesStore((state) => state.setDraft);
  const setVideoLibrary = useOurTailTalesStore((state) => state.setVideoLibrary);
  const setNotice = useOurTailTalesStore((state) => state.setVideoNotice);

  const [config, setConfig] = useState<VideoMemoryPublicConfig | null>(null);
  const [busy, setBusy] = useState(false);

  const draft = useMemo<StoredDraft | null>(
    () => (draftId && draftSecret ? { draftId, secret: draftSecret } : null),
    [draftId, draftSecret],
  );

  const refresh = useCallback(
    async (nextDraft?: StoredDraft) => {
      const active = nextDraft ?? draft;
      if (!active) return;
      const library = await fetchVideoLibrary(active);
      setVideoLibrary(library.assets, library.placements);
    },
    [draft, setVideoLibrary],
  );

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        // The draft the book is already banked against comes first. Asking for
        // one unconditionally means a browser whose local copy has been
        // cleared gets a brand new draft here, and the book's own id is then
        // replaced by one with no PDF behind it — no clean copy to sell, and
        // an order pointing at nothing. Only a book with no draft needs one.
        const held = useOurTailTalesStore.getState();
        const [nextDraft, nextConfig] = await Promise.all([
          held.draftId && held.draftSecret
            ? Promise.resolve({ draftId: held.draftId, secret: held.draftSecret })
            : ensureDraft(held.leadEmail),
          cachedConfig ?? fetchVideoMemoryConfig(),
        ]);
        if (cancelled) return;
        cachedConfig = nextConfig;
        setDraft(nextDraft.draftId, nextDraft.secret);
        setConfig(nextConfig);
        if (loadedForDraft === nextDraft.draftId) return;
        const library = await fetchVideoLibrary(nextDraft);
        if (cancelled) return;
        loadedForDraft = nextDraft.draftId;
        setVideoLibrary(library.assets, library.placements);
      } catch (error) {
        if (!cancelled) {
          setNotice(
            error instanceof Error ? error.message : STORAGE_UNAVAILABLE_MESSAGE,
          );
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [setDraft, setVideoLibrary, setNotice]);

  const needsPoll = assets.some(
    (asset) => asset.status === "uploaded" || asset.status === "processing",
  );

  useEffect(() => {
    if (!draft || !needsPoll) return;
    const timer = window.setInterval(() => {
      void refresh().catch(() => {
        // Keep the last known library; the next tick retries.
      });
    }, POLL_MS);
    return () => window.clearInterval(timer);
  }, [draft, needsPoll, refresh]);

  /** Every change goes through here: one busy flag, one place errors surface. */
  const run = useCallback(
    async (work: (active: StoredDraft) => Promise<void>) => {
      const active = draft;
      if (!active || busy) return;
      setBusy(true);
      setNotice(null);
      try {
        await work(active);
        await refresh(active);
      } catch (error) {
        setNotice(
          error instanceof Error ? error.message : STORAGE_UNAVAILABLE_MESSAGE,
        );
      } finally {
        setBusy(false);
      }
    },
    [busy, draft, refresh, setNotice],
  );

  const uniquePlaced = includedUniqueVideoCount(placements);
  const meter = packMeterView(uniquePlaced);

  const opensNewPack = useCallback(
    (assetId: string) =>
      wouldOpenNewPack(
        uniquePlaced,
        !placements.some((placement) => placement.videoAssetId === assetId),
      ),
    [placements, uniquePlaced],
  );

  const upload = useCallback(
    async (file: File) => {
      const active = draft;
      if (!active || busy) return;
      const maxBytes = config?.maxSourceBytes;
      if (maxBytes && file.size > maxBytes) {
        setNotice(sourceTooLargeMessage(maxBytes));
        return;
      }
      setBusy(true);
      setNotice(null);
      try {
        const durationMs = await readVideoDurationMs(file);
        if (
          !isAcceptableVideoDuration(durationMs) ||
          (config && durationMs > config.maxDurationMs)
        ) {
          setNotice(config?.durationTooLongMessage ?? DURATION_TOO_LONG_MESSAGE);
          return;
        }
        await uploadVideoMemory(active, file, {
          durationMs,
          title: file.name.replace(/\.[^.]+$/, "").slice(0, 60),
        });
        await refresh(active);
      } catch (error) {
        setNotice(
          error instanceof Error ? error.message : STORAGE_UNAVAILABLE_MESSAGE,
        );
      } finally {
        setBusy(false);
      }
    },
    [busy, config, draft, refresh, setNotice],
  );

  return {
    assets,
    placements,
    draft,
    config,
    notice,
    setNotice,
    busy,
    meter,
    uniquePlaced,
    opensNewPack,
    upload,
    place: useCallback(
      (assetId, pageId) =>
        run(async (active) => {
          await placeVideoMemory(active, assetId, pageId);
        }),
      [run],
    ),
    movePlacement: useCallback(
      (placementId, pageId) =>
        run((active) => updatePlacementPage(active, placementId, pageId)),
      [run],
    ),
    removePlacement: useCallback(
      (placementId) => run((active) => removePlacementFromPage(active, placementId)),
      [run],
    ),
    // Not through `run`, which stands aside while anything else is in flight:
    // a video that is still uploading keeps the library busy, and that is
    // exactly the video somebody wants to be rid of.
    removeAsset: useCallback(
      async (assetId: string) => {
        const active = draft;
        if (!active) return;
        setNotice(null);
        try {
          await deleteVideoMemory(active, assetId);
          await refresh(active);
        } catch (error) {
          setNotice(
            error instanceof Error ? error.message : STORAGE_UNAVAILABLE_MESSAGE,
          );
        }
      },
      [draft, refresh, setNotice],
    ),
    retry: useCallback(
      (assetId) => run((active) => retryVideoMemory(active, assetId)),
      [run],
    ),
    renameLocally: useCallback(
      (assetId, title) => {
        setVideoLibrary(
          assets.map((entry) =>
            entry.id === assetId ? { ...entry, title } : entry,
          ),
          placements,
        );
      },
      [assets, placements, setVideoLibrary],
    ),
    saveTitle: useCallback(
      (assetId, title) => {
        const active = draft;
        if (!active) return;
        void renameVideoMemory(
          active,
          assetId,
          title.trim() || "Video Memory",
        ).catch((error: unknown) => {
          setNotice(
            error instanceof Error ? error.message : STORAGE_UNAVAILABLE_MESSAGE,
          );
        });
      },
      [draft, setNotice],
    ),
  };
}
