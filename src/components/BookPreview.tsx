"use client";

import { useEffect, useMemo, useState } from "react";

import { PagePreview } from "@/components/PagePreview";
import type { BookMeta, BookPage, Chapter } from "@/types/book";
import type { PhotoAsset } from "@/types/photo";

export function BookPreview({
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
  const [active, setActive] = useState(0);
  const chaptersById = useMemo(
    () => new Map(chapters.map((chapter) => [chapter.id, chapter])),
    [chapters],
  );

  const clamped = Math.min(active, Math.max(0, pages.length - 1));
  const page = pages[clamped];

  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === "ArrowRight") {
        setActive((current) => Math.min(current + 1, pages.length - 1));
      }
      if (event.key === "ArrowLeft") {
        setActive((current) => Math.max(current - 1, 0));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pages.length]);

  if (!page) return null;

  return (
    <div className="space-y-4">
      <div className="mx-auto w-full max-w-md">
        <div className="overflow-hidden rounded-sm shadow-book ring-1 ring-ink/10">
          <PagePreview
            page={page}
            chapter={page.chapterId ? chaptersById.get(page.chapterId) : undefined}
            meta={meta}
            photos={photos}
            showTrimGuide
          />
        </div>

        <div className="mt-3 flex items-center justify-between">
          <button
            type="button"
            onClick={() => setActive((current) => Math.max(current - 1, 0))}
            disabled={clamped === 0}
            className={navClass}
          >
            &larr; Previous
          </button>
          <p className="text-xs text-ink-faint">
            {pageLabel(page)} · page {page.pageNumber} of {pages.length}
          </p>
          <button
            type="button"
            onClick={() =>
              setActive((current) => Math.min(current + 1, pages.length - 1))
            }
            disabled={clamped === pages.length - 1}
            className={navClass}
          >
            Next &rarr;
          </button>
        </div>
        <p className="mt-1 text-center text-[11px] text-ink-faint">
          The dashed line shows where the page is trimmed. Photos run past it on
          purpose.
        </p>
      </div>

      <ol className="grid grid-cols-6 gap-2 sm:grid-cols-10">
        {pages.map((candidate, index) => (
          <li key={candidate.id}>
            <button
              type="button"
              onClick={() => setActive(index)}
              aria-current={index === clamped}
              title={`${pageLabel(candidate)} — page ${candidate.pageNumber}`}
              className={`block w-full overflow-hidden rounded-sm ring-1 transition-all ${
                index === clamped
                  ? "ring-2 ring-tail"
                  : "ring-ink/10 hover:ring-tail/50"
              }`}
            >
              <PagePreview
                page={candidate}
                chapter={
                  candidate.chapterId
                    ? chaptersById.get(candidate.chapterId)
                    : undefined
                }
                meta={meta}
                photos={photos}
              />
            </button>
          </li>
        ))}
      </ol>
    </div>
  );
}

const navClass =
  "rounded-full border border-line px-3 py-1.5 text-xs text-ink-soft transition-colors enabled:hover:border-tail enabled:hover:text-tail-deep disabled:opacity-40";

function pageLabel(page: BookPage): string {
  switch (page.kind) {
    case "title":
      return "Title";
    case "dedication":
      return "Dedication";
    case "chapter-opener":
      return `Chapter ${(page.chapterIndex ?? 0) + 1} opener`;
    case "closing":
      return "Closing";
    case "imprint":
      return "Imprint";
    default:
      return `Chapter ${(page.chapterIndex ?? 0) + 1}`;
  }
}
