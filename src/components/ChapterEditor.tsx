"use client";

import { useState } from "react";

import { placeSummary } from "@/lib/story/client";
import type { Chapter } from "@/types/book";
import type { PhotoAsset } from "@/types/photo";

export function ChapterEditor({
  chapters,
  photos,
  coverPhotoId,
  onTextChange,
  onSwap,
  onReorder,
  onSetCover,
  onRegenerate,
}: {
  chapters: Chapter[];
  photos: Map<string, PhotoAsset>;
  coverPhotoId: string | null;
  onTextChange: (
    chapterId: string,
    patch: Partial<Pick<Chapter, "title" | "blurb" | "dateLabel">>,
  ) => void;
  onSwap: (chapterId: string, outgoingId: string, incomingId: string) => void;
  onReorder: (chapterId: string, photoId: string, toIndex: number) => void;
  onSetCover: (photoId: string) => void;
  onRegenerate: (chapterId: string) => void;
}) {
  const [activeId, setActiveId] = useState(chapters[0]?.id ?? "");
  const [swapTarget, setSwapTarget] = useState<string | null>(null);
  const [dragged, setDragged] = useState<string | null>(null);

  const chapter = chapters.find((entry) => entry.id === activeId) ?? chapters[0];
  if (!chapter) return null;

  const available = chapter.candidateIds.filter(
    (id) => !chapter.photoIds.includes(id),
  );

  return (
    <section className="space-y-5">
      <nav className="flex flex-wrap gap-2" aria-label="Chapters">
        {chapters.map((entry) => (
          <button
            key={entry.id}
            type="button"
            onClick={() => {
              setActiveId(entry.id);
              setSwapTarget(null);
            }}
            className={`rounded-full border px-3.5 py-1.5 text-sm transition-colors ${
              entry.id === chapter.id
                ? "border-tail bg-tail text-paper"
                : "border-line bg-paper text-ink-soft hover:border-tail"
            }`}
          >
            {entry.index + 1}. {truncate(entry.title, 22)}
            {entry.aiStatus === "error" && <span className="ml-1">&#9888;</span>}
          </button>
        ))}
      </nav>

      <div className="rounded-2xl border border-line bg-paper p-5 shadow-lift sm:p-6">
        <div className="grid gap-4 sm:grid-cols-[2fr_1fr]">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-ink-soft">
              Chapter title
            </span>
            <input
              value={chapter.title}
              onChange={(event) =>
                onTextChange(chapter.id, { title: event.target.value.slice(0, 60) })
              }
              className={inputClass}
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-ink-soft">
              Date label
            </span>
            <input
              value={chapter.dateLabel}
              onChange={(event) =>
                onTextChange(chapter.id, {
                  dateLabel: event.target.value.slice(0, 40),
                })
              }
              className={inputClass}
            />
          </label>
        </div>

        <label className="mt-4 block">
          <span className="mb-1.5 flex items-baseline justify-between text-sm font-medium text-ink-soft">
            <span>Opening words</span>
            <span className="text-xs font-normal text-ink-faint">
              {wordCount(chapter.blurb)} words
            </span>
          </span>
          <textarea
            value={chapter.blurb}
            onChange={(event) =>
              onTextChange(chapter.id, { blurb: event.target.value.slice(0, 900) })
            }
            rows={5}
            placeholder="Write this chapter's opening, or generate one."
            className={`${inputClass} resize-none leading-relaxed`}
          />
        </label>

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => onRegenerate(chapter.id)}
            disabled={chapter.aiStatus === "pending"}
            className="rounded-full border border-line px-4 py-1.5 text-sm text-ink-soft transition-colors enabled:hover:border-tail enabled:hover:text-tail-deep disabled:opacity-50"
          >
            {chapter.aiStatus === "pending"
              ? "Writing…"
              : "Regenerate this chapter"}
          </button>
          {chapter.places.length > 0 && (
            <p className="text-xs text-ink-faint">
              Places: {placeSummary(chapter.places)}
            </p>
          )}
          {chapter.aiStatus === "error" && (
            <p className="text-xs text-tail-deep">
              {chapter.aiError ?? "That chapter could not be written."} You can
              type it yourself.
            </p>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-line bg-paper p-5 shadow-lift sm:p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="font-display text-lg text-ink">
            Photos in this chapter
          </h3>
          <p className="text-xs text-ink-faint">
            Drag to reorder. Click a photo to swap it.
          </p>
        </div>

        <ol className="mt-4 grid grid-cols-4 gap-2 sm:grid-cols-6">
          {chapter.photoIds.map((photoId, index) => {
            const photo = photos.get(photoId);
            if (!photo) return null;
            const isHero = chapter.heroPhotoId === photoId;
            const isCover = coverPhotoId === photoId;

            return (
              <li
                key={photoId}
                draggable
                onDragStart={() => setDragged(photoId)}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault();
                  if (dragged && dragged !== photoId) {
                    onReorder(chapter.id, dragged, index);
                  }
                  setDragged(null);
                }}
                className="group relative"
              >
                <button
                  type="button"
                  onClick={() =>
                    setSwapTarget(swapTarget === photoId ? null : photoId)
                  }
                  className={`block w-full overflow-hidden rounded-md ring-1 transition-all ${
                    swapTarget === photoId
                      ? "ring-2 ring-tail"
                      : "ring-ink/10 hover:ring-tail/60"
                  }`}
                  title={`Photo ${index + 1}${isHero ? " · chapter opener" : ""}`}
                >
                  <span className="block aspect-square">
                    {/* eslint-disable-next-line @next/next/no-img-element -- local object URL */}
                    <img
                      src={photo.thumbUrl}
                      alt=""
                      loading="lazy"
                      className="h-full w-full object-cover"
                    />
                  </span>
                </button>

                {(isHero || isCover) && (
                  <span className="pointer-events-none absolute left-1 top-1 rounded bg-ink/75 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-paper">
                    {isCover ? "Cover" : "Opener"}
                  </span>
                )}

                {photo.qualityScore < 0.3 && (
                  <span
                    className="pointer-events-none absolute right-1 top-1 rounded bg-tail px-1 py-0.5 text-[10px] text-paper"
                    title="This photo may look soft in print"
                  >
                    !
                  </span>
                )}

                <span className="mt-1 flex justify-center gap-1 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
                  <MoveButton
                    label="Move earlier"
                    disabled={index === 0}
                    onClick={() => onReorder(chapter.id, photoId, index - 1)}
                  >
                    &larr;
                  </MoveButton>
                  <MoveButton
                    label="Use as cover"
                    disabled={isCover}
                    onClick={() => onSetCover(photoId)}
                  >
                    &#9733;
                  </MoveButton>
                  <MoveButton
                    label="Move later"
                    disabled={index === chapter.photoIds.length - 1}
                    onClick={() => onReorder(chapter.id, photoId, index + 1)}
                  >
                    &rarr;
                  </MoveButton>
                </span>
              </li>
            );
          })}
        </ol>

        {swapTarget && (
          <div className="mt-5 rounded-xl border border-tail/30 bg-tail-wash/40 p-4">
            <p className="text-sm text-ink-soft">
              {available.length > 0
                ? "Choose a replacement from this chapter."
                : "Every photo from this chapter is already in the book."}
            </p>
            {available.length > 0 && (
              <ol className="mt-3 grid max-h-64 grid-cols-5 gap-2 overflow-y-auto sm:grid-cols-8">
                {available.map((candidateId) => {
                  const candidate = photos.get(candidateId);
                  if (!candidate) return null;
                  return (
                    <li key={candidateId}>
                      <button
                        type="button"
                        onClick={() => {
                          onSwap(chapter.id, swapTarget, candidateId);
                          setSwapTarget(null);
                        }}
                        className="block w-full overflow-hidden rounded-md ring-1 ring-ink/10 transition-all hover:ring-2 hover:ring-tail"
                      >
                        <span className="block aspect-square">
                          {/* eslint-disable-next-line @next/next/no-img-element -- local object URL */}
                          <img
                            src={candidate.thumbUrl}
                            alt=""
                            loading="lazy"
                            className="h-full w-full object-cover"
                          />
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ol>
            )}
            <button
              type="button"
              onClick={() => setSwapTarget(null)}
              className="mt-3 text-xs text-ink-soft underline decoration-line underline-offset-4 hover:text-tail-deep"
            >
              Cancel swap
            </button>
          </div>
        )}
      </div>
    </section>
  );
}

function MoveButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="rounded border border-line bg-paper px-1.5 text-[11px] leading-5 text-ink-soft transition-colors enabled:hover:border-tail enabled:hover:text-tail-deep disabled:opacity-30"
    >
      {children}
    </button>
  );
}

const inputClass =
  "w-full rounded-lg border border-line bg-paper px-3.5 py-2.5 text-ink outline-none transition-colors placeholder:text-ink-faint focus:border-tail focus:ring-2 focus:ring-tail/20";

function wordCount(text: string): number {
  const trimmed = text.trim();
  return trimmed === "" ? 0 : trimmed.split(/\s+/).length;
}

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}
