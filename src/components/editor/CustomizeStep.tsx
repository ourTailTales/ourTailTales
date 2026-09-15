"use client";

import { useMemo } from "react";

import { ChapterEditor } from "@/components/ChapterEditor";
import { VideoMemoriesPanel } from "@/components/VideoMemoriesPanel";
import { possessivePetName } from "@/lib/book/pagination";
import { bookSpec, formatUsd } from "@/lib/pricing";
import { photoMapOf, useOurTailTalesStore } from "@/store/useOurTailTalesStore";

export function CustomizeStep({
  onCreateStory,
  onPreview,
  onRegenerate,
}: {
  onCreateStory: () => void;
  onPreview: () => void;
  onRegenerate: (chapterId: string) => void;
}) {
  const funnelState = useOurTailTalesStore((state) => state.funnelState);
  const meta = useOurTailTalesStore((state) => state.meta);
  const chapterCount = useOurTailTalesStore((state) => state.chapterCount);
  const chapters = useOurTailTalesStore((state) => state.chapters);
  const pages = useOurTailTalesStore((state) => state.pages);
  const photos = useOurTailTalesStore((state) => state.photos);
  const exportMessage = useOurTailTalesStore((state) => state.exportMessage);
  const updateChapterText = useOurTailTalesStore((state) => state.updateChapterText);
  const swapChapterPhoto = useOurTailTalesStore((state) => state.swapChapterPhoto);
  const reorderChapterPhoto = useOurTailTalesStore(
    (state) => state.reorderChapterPhoto,
  );
  const setCoverPhoto = useOurTailTalesStore((state) => state.setCoverPhoto);

  const photoMap = useMemo(() => photoMapOf(photos), [photos]);
  const spec = useMemo(() => bookSpec(chapterCount), [chapterCount]);
  const storyDone = chapters.filter((chapter) => chapter.aiStatus === "done").length;

  return (
    <div className="space-y-5">
      <div>
        <p className="font-display text-xl text-page-ink sm:text-2xl">
          {possessivePetName(meta.petName || "Your pet")} story
        </p>
        <p className="mt-1 text-sm text-page-ink-soft">
          {chapterCount} chapters · {formatUsd(spec.price)} hardcover
        </p>
      </div>

      {funnelState === "organizing" && (
        <button
          type="button"
          onClick={onCreateStory}
          className="rounded-xl bg-periwinkle px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-periwinkle-deep"
        >
          Create My Story
        </button>
      )}

      {funnelState === "ai_generating" && (
        <p
          role="status"
          className="rounded-2xl border border-page-line bg-lavender/40 px-4 py-3 text-sm text-page-ink-soft"
        >
          Writing your chapters — {storyDone} of {chapters.length} done.
        </p>
      )}

      {funnelState === "exporting" && (
        <p
          role="status"
          className="rounded-xl border border-periwinkle/30 bg-periwinkle-wash/40 px-4 py-3 text-sm text-periwinkle-deep"
        >
          {exportMessage ?? "Preparing your book…"}
        </p>
      )}

      <ChapterEditor
        chapters={chapters}
        photos={photoMap}
        coverPhotoId={meta.coverPhotoId}
        onTextChange={updateChapterText}
        onSwap={swapChapterPhoto}
        onReorder={reorderChapterPhoto}
        onSetCover={setCoverPhoto}
        onRegenerate={onRegenerate}
        onPreview={pages.length > 0 ? onPreview : undefined}
      />

      <VideoMemoriesPanel pages={pages} />
    </div>
  );
}
