"use client";

import { useMemo, useState } from "react";

import { ChapterEditor } from "@/components/ChapterEditor";
import { VideoMemoriesPanel } from "@/components/VideoMemoriesPanel";
import { BackCoverEditor } from "@/components/editor/BackCoverEditor";
import {
  BookSectionNav,
  sectionKey,
  type EditorSection,
} from "@/components/editor/BookSectionNav";
import { CoverEditor } from "@/components/editor/CoverEditor";
import { OtherPagesEditor } from "@/components/editor/OtherPagesEditor";
import { selectablePhotos } from "@/lib/photo/dedupe";
import { photoMapOf, useOurTailTalesStore } from "@/store/useOurTailTalesStore";

export function CustomizeStep({
  onCreateStory,
  onRegenerate,
  enableVideoMemories = true,
}: {
  onCreateStory: () => void;
  onRegenerate: (chapterId: string) => void;
  enableVideoMemories?: boolean;
}) {
  const funnelState = useOurTailTalesStore((state) => state.funnelState);
  const meta = useOurTailTalesStore((state) => state.meta);
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
  const setMeta = useOurTailTalesStore((state) => state.setMeta);

  const photoMap = useMemo(() => photoMapOf(photos), [photos]);
  const pickablePhotos = useMemo(() => selectablePhotos(photos), [photos]);
  const storyDone = chapters.filter((chapter) => chapter.aiStatus === "done").length;

  const [section, setSection] = useState<EditorSection>({ kind: "cover" });
  const activeChapterId =
    section.kind === "chapter"
      ? (chapters.find((chapter) => chapter.id === section.chapterId)?.id ??
        chapters[0]?.id ??
        "")
      : (chapters[0]?.id ?? "");

  return (
    <div className="space-y-5">


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

      <div className="grid gap-6 lg:grid-cols-[14rem_1fr] lg:items-start">
        <BookSectionNav
          chapters={chapters}
          active={section}
          onSelect={setSection}
        />

        <div key={sectionKey(section)}>
          {section.kind === "cover" && (
            <CoverEditor
              meta={meta}
              photos={pickablePhotos}
              onMetaChange={setMeta}
              onSetCover={setCoverPhoto}
            />
          )}

          {section.kind === "chapter" && chapters.length > 0 && (
            <ChapterEditor
              chapters={chapters}
              activeChapterId={activeChapterId}
              photos={photoMap}
              coverPhotoId={meta.coverPhotoId}
              onTextChange={updateChapterText}
              onSwap={swapChapterPhoto}
              onReorder={reorderChapterPhoto}
              onSetCover={setCoverPhoto}
              onRegenerate={onRegenerate}
            />
          )}

          {section.kind === "other" && (
            <OtherPagesEditor onSelect={setSection} />
          )}

          {section.kind === "back-cover" && (
            <BackCoverEditor meta={meta} onMetaChange={setMeta} />
          )}
        </div>
      </div>

      {enableVideoMemories ? <VideoMemoriesPanel pages={pages} /> : null}
    </div>
  );
}
