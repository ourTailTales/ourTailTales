"use client";

import { useEffect, useMemo, useState } from "react";

import { PagePreview } from "@/components/PagePreview";
import type { BookMeta, BookPage, Chapter } from "@/types/book";
import type { PhotoAsset } from "@/types/photo";

/**
 * Facing-page preview that lives inside the open hardcover spread.
 * Advances two pages at a time (left + right).
 */
export function InBookPreview({
  pages,
  chapters,
  meta,
  photos,
}: {
  pages: BookPage[];
  chapters: Chapter[];
  meta: BookMeta;
  photos: Map<string, PhotoAsset>;
}) {
  const [leftIndex, setLeftIndex] = useState(0);
  const [trackedLength, setTrackedLength] = useState(pages.length);

  if (trackedLength !== pages.length) {
    setTrackedLength(pages.length);
    setLeftIndex(0);
  }

  const chaptersById = useMemo(
    () => new Map(chapters.map((chapter) => [chapter.id, chapter])),
    [chapters],
  );

  const safeLeft = Math.min(
    leftIndex - (leftIndex % 2),
    Math.max(0, pages.length - 1),
  );

  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === "ArrowRight") {
        setLeftIndex((current) => {
          const next = current - (current % 2) + 2;
          return Math.min(next, Math.max(0, pages.length - 1));
        });
      }
      if (event.key === "ArrowLeft") {
        setLeftIndex((current) => Math.max(current - (current % 2) - 2, 0));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pages.length]);

  const left = pages[safeLeft];
  const right = pages[safeLeft + 1];
  if (!left) {
    return (
      <div className="flex h-full items-center justify-center bg-[#f7f9fd] px-6 text-center">
        <p className="font-display text-lg text-ink-soft">
          Your pages will appear here…
        </p>
      </div>
    );
  }

  const atStart = safeLeft <= 0;
  const atEnd = safeLeft + 1 >= pages.length - 1;

  return (
    <div className="flex h-full w-full flex-col">
      <div className="grid min-h-0 flex-1 grid-cols-2 gap-px bg-line/40">
        <div className="relative min-h-0 bg-white">
          <PagePreview
            page={left}
            chapter={left.chapterId ? chaptersById.get(left.chapterId) : undefined}
            meta={meta}
            photos={photos}
            showTrimGuide
          />
        </div>
        <div className="relative min-h-0 bg-white">
          {right ? (
            <PagePreview
              page={right}
              chapter={
                right.chapterId ? chaptersById.get(right.chapterId) : undefined
              }
              meta={meta}
              photos={photos}
              showTrimGuide
            />
          ) : (
            <div className="flex h-full items-center justify-center bg-[#f7f9fd]">
              <span className="h-px w-1/4 bg-line" aria-hidden />
            </div>
          )}
        </div>
      </div>

      <div className="flex shrink-0 items-center justify-between gap-2 border-t border-line/50 bg-white/90 px-2 py-1.5">
        <button
          type="button"
          onClick={() =>
            setLeftIndex((current) => Math.max(current - (current % 2) - 2, 0))
          }
          disabled={atStart}
          className={navClass}
        >
          &larr;
        </button>
        <p className="min-w-0 truncate text-center text-[10px] text-ink-faint">
          {pageLabel(left)}
          {right ? ` · ${pageLabel(right)}` : ""} · {left.pageNumber}
          {right ? `–${right.pageNumber}` : ""} / {pages.length}
        </p>
        <button
          type="button"
          onClick={() =>
            setLeftIndex((current) => {
              const base = current - (current % 2);
              return Math.min(base + 2, Math.max(0, pages.length - 1));
            })
          }
          disabled={atEnd}
          className={navClass}
        >
          &rarr;
        </button>
      </div>
    </div>
  );
}

const navClass =
  "rounded-md border border-line px-2 py-0.5 text-xs text-ink-soft transition-colors enabled:hover:border-periwinkle enabled:hover:text-periwinkle-deep disabled:opacity-35";

function pageLabel(page: BookPage): string {
  switch (page.kind) {
    case "title":
      return "Title";
    case "dedication":
      return "Dedication";
    case "chapter-opener":
      return `Ch. ${(page.chapterIndex ?? 0) + 1}`;
    case "closing":
      return "Closing";
    case "imprint":
      return "Imprint";
    default:
      return `Ch. ${(page.chapterIndex ?? 0) + 1}`;
  }
}
