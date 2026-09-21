"use client";

import type { Chapter } from "@/types/book";

export type EditorSection =
  | { kind: "cover" }
  | { kind: "chapter"; chapterId: string }
  | { kind: "other" }
  | { kind: "back-cover" };

export function sectionKey(section: EditorSection): string {
  return section.kind === "chapter"
    ? `chapter:${section.chapterId}`
    : section.kind;
}

export function BookSectionNav({
  chapters,
  active,
  onSelect,
}: {
  chapters: Chapter[];
  active: EditorSection;
  onSelect: (section: EditorSection) => void;
}) {
  const activeKey = sectionKey(active);

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

      <p className="mt-1 hidden px-3 text-[11px] font-medium uppercase tracking-wide text-page-ink-faint lg:block">
        Chapters
      </p>
      {chapters.map((chapter) => (
        <NavButton
          key={chapter.id}
          label={`${chapter.index + 1}. ${truncate(chapter.title || `Chapter ${chapter.index + 1}`, 24)}`}
          active={activeKey === `chapter:${chapter.id}`}
          warn={chapter.aiStatus === "error"}
          onClick={() => onSelect({ kind: "chapter", chapterId: chapter.id })}
        />
      ))}

      <NavButton
        label="Other pages"
        active={activeKey === "other"}
        onClick={() => onSelect({ kind: "other" })}
      />
      <NavButton
        label="Back cover"
        active={activeKey === "back-cover"}
        onClick={() => onSelect({ kind: "back-cover" })}
      />
    </nav>
  );
}

function NavButton({
  label,
  active,
  warn,
  onClick,
}: {
  label: string;
  active: boolean;
  warn?: boolean;
  onClick: () => void;
}) {
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

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}
