"use client";

import { Sparkles } from "lucide-react";
import { useMemo } from "react";

import { PageCanvas } from "@/components/book-viewer/PageCanvas";
import { layoutGroups } from "@/lib/book/layouts";
import type { BookMeta, BookPage, PhotoLayoutId } from "@/types/book";

const NO_CHAPTERS: never[] = [];
const NO_PHOTOS = new Map();

/** Stand-in words in the layout previews, so a note card reads as a note card. */
const PREVIEW_NOTE = "Your words about this page go here.";

/**
 * Every page layout, drawn in the book's own design.
 *
 * Each option is a real page from the design with placeholder photos, so what
 * is offered is exactly what the page becomes — tilted polaroids in the
 * scrapbook, a clean grid in Classic. A layout needing more photos than the
 * chapter has is shown but cannot be picked, with the reason on it.
 *
 * Split in two, because twenty-two squares in one grid is a wall: the
 * photographs-only layouts first, then the ones that keep room for words.
 */
export function LayoutPicker({
  meta,
  current,
  chosen,
  maxPhotos,
  onPick,
}: {
  meta: BookMeta;
  /** The layout the page is in now. */
  current: PhotoLayoutId | null;
  /** True when the customer picked `current`, false when the book did. */
  chosen: boolean;
  /** The most photos this page could hold. */
  maxPhotos: number;
  onPick: (layoutId: PhotoLayoutId | null) => void;
}) {
  const groups = useMemo(
    () =>
      layoutGroups().map((group) => ({
        ...group,
        previews: group.layouts.map((layout) => ({
          layout,
          page: {
            id: `layout-preview-${layout.id}`,
            kind: "photos",
            pageNumber: 0,
            layoutId: layout.id,
            photoIds: Array.from({ length: layout.photoCount }, (_, index) => `preview-${index}`),
            // Sample words, so a layout that holds writing looks like one.
            ...(layout.noteCount > 0
              ? { notes: Array.from({ length: layout.noteCount }, () => PREVIEW_NOTE) }
              : {}),
          } satisfies BookPage,
        })),
      })),
    [],
  );

  return (
    <div className="flex flex-col gap-4">
      <div role="radiogroup" aria-label="Page layout" className="grid grid-cols-[repeat(auto-fill,minmax(80px,1fr))] gap-2">
        <button
          type="button"
          role="radio"
          aria-checked={!chosen}
          onClick={() => onPick(null)}
          className={`flex aspect-square flex-col items-center justify-center gap-1.5 rounded-lg border p-2 text-center transition-colors ${
            !chosen
              ? "border-periwinkle bg-periwinkle-wash/50 ring-2 ring-periwinkle/30"
              : "border-page-line bg-white hover:border-periwinkle"
          }`}
        >
          <Sparkles aria-hidden className="size-5 text-periwinkle" />
          <span className="text-xs font-medium text-page-ink">Automatic</span>
          <span className="text-[0.65rem] leading-3 text-page-ink-faint">Best fit for these photos</span>
        </button>

        {groups[0]!.previews.map(({ layout, page }) => (
          <LayoutOption
            key={layout.id}
            label={layout.label}
            photoCount={layout.photoCount}
            page={page}
            meta={meta}
            active={chosen && current === layout.id}
            inUse={!chosen && current === layout.id}
            tooMany={layout.photoCount > maxPhotos}
            onPick={() => onPick(layout.id)}
          />
        ))}
      </div>

      <div>
        <p className="mb-2 text-xs font-medium text-page-ink-soft">
          {groups[1]!.label}
          <span className="ml-1.5 font-normal text-page-ink-faint">
            room for a line or two of your own
          </span>
        </p>
        <div role="radiogroup" aria-label="Page layout with words" className="grid grid-cols-[repeat(auto-fill,minmax(80px,1fr))] gap-2">
          {groups[1]!.previews.map(({ layout, page }) => (
            <LayoutOption
              key={layout.id}
              label={layout.label}
              photoCount={layout.photoCount}
              page={page}
              meta={meta}
              active={chosen && current === layout.id}
              inUse={!chosen && current === layout.id}
              tooMany={layout.photoCount > maxPhotos}
              onPick={() => onPick(layout.id)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function LayoutOption({
  label,
  photoCount,
  page,
  meta,
  active,
  inUse,
  tooMany,
  onPick,
}: {
  label: string;
  photoCount: number;
  page: BookPage;
  meta: BookMeta;
  active: boolean;
  /** The layout the book chose for this page, which the customer has not overridden. */
  inUse: boolean;
  tooMany: boolean;
  onPick: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      disabled={tooMany}
      onClick={onPick}
      title={
        tooMany
          ? `This chapter doesn't have ${photoCount} photos to spare for one page.`
          : label
      }
      className={`group relative flex flex-col overflow-hidden rounded-lg border text-left transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
        active
          ? "border-periwinkle ring-2 ring-periwinkle/30"
          : "border-page-line hover:border-periwinkle disabled:hover:border-page-line"
      }`}
    >
      <PageCanvas page={page} meta={meta} chapters={NO_CHAPTERS} photos={NO_PHOTOS} placeholder />
      <span className="flex items-baseline justify-between gap-1 border-t border-page-line bg-white px-1.5 py-1">
        <span className="truncate text-[0.68rem] font-medium text-page-ink">{label}</span>
        <span className="shrink-0 text-[0.62rem] text-page-ink-faint">{photoCount}</span>
      </span>
      {inUse ? (
        <span className="absolute left-1 top-1 rounded-full bg-white/90 px-1.5 py-0.5 text-[0.6rem] font-medium text-page-ink-soft shadow-sm">
          In use
        </span>
      ) : null}
    </button>
  );
}
