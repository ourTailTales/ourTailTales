"use client";

import { Lock } from "lucide-react";

import type { Chapter } from "@/types/book";

export type EditorSection =
  | { kind: "cover" }
  | { kind: "chapter"; chapterId: string }
  | { kind: "other" };

export function sectionKey(section: EditorSection): string {
  return section.kind === "chapter"
    ? `chapter:${section.chapterId}`
    : section.kind;
}

export function BookSectionNav({
  chapters,
  active,
  onSelect,
  coverDone,
}: {
  chapters: Chapter[];
  active: EditorSection;
  onSelect: (section: EditorSection) => void;
  /** Front + back cover both have what they need — gates the Chapters tab. */
  coverDone: boolean;
}) {
  const activeKey = sectionKey(active);
  const chaptersReady = chapters.length > 0;
  const chaptersLocked = !chaptersReady || !coverDone;
  const chaptersLockedTitle = !chaptersReady
    ? "Add photos to build your chapters first"
    : "Finish the front and back cover first";

  return (
    <nav
      aria-label="Book sections"
      className="flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible lg:pb-0"
    >
      <NavButton
        label="Cover"
        active={activeKey === "cover"}
        onClick={() => onSelect({ kind: "cover" })}
      />

      <NavButton
        label="Chapters"
        active={activeKey.startsWith("chapter:")}
        warn={chapters.some((chapter) => chapter.aiStatus === "error")}
        locked={chaptersLocked}
        lockedTitle={chaptersLockedTitle}
        onClick={() =>
          onSelect({
            kind: "chapter",
            chapterId:
              active.kind === "chapter" ? active.chapterId : (chapters[0]?.id ?? ""),
          })
        }
      />

      <NavButton
        label="Other pages"
        active={activeKey === "other"}
        locked
        onClick={() => onSelect({ kind: "other" })}
      />
    </nav>
  );
}

function NavButton({
  label,
  active,
  warn,
  locked,
  lockedTitle = "Coming soon",
  onClick,
}: {
  label: string;
  active: boolean;
  warn?: boolean;
  locked?: boolean;
  lockedTitle?: string;
  onClick: () => void;
}) {
  if (locked) {
    return (
      <button
        type="button"
        disabled
        title={lockedTitle}
        aria-disabled="true"
        className="flex shrink-0 cursor-not-allowed items-center gap-1.5 rounded-full px-3.5 py-1.5 text-left text-sm text-page-ink-faint/70 lg:w-full lg:rounded-lg"
      >
        <span className="truncate">{label}</span>
        <Lock className="h-3.5 w-3.5 shrink-0" aria-hidden />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 rounded-full px-3.5 py-1.5 text-left text-sm transition-colors lg:w-full lg:rounded-lg ${
        active
          ? "bg-periwinkle text-white"
          : "text-page-ink-soft hover:bg-periwinkle/10 hover:text-periwinkle-deep"
      }`}
    >
      {label}
      {warn && <span className="ml-1">&#9888;</span>}
    </button>
  );
}
