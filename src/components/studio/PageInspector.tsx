"use client";

import { cloneElement, isValidElement, useId, useMemo, useState } from "react";
import { Info, RefreshCw } from "lucide-react";

import { AddMediaControl } from "@/components/editor/AddMediaControl";
import { CustomCoverPanel } from "@/components/editor/CustomCoverPanel";
import { LayoutThumbnail } from "@/components/editor/LayoutThumbnail";
import { NamePositionPicker } from "@/components/studio/controls/NamePositionPicker";
import { PhotoPicker } from "@/components/studio/controls/PhotoPicker";
import {
  COVER_FONTS,
  COVER_LAYOUTS,
  DEFAULT_COVER_FONT,
  DEFAULT_COVER_LAYOUT,
  DEFAULT_COVER_NAME_SIZE,
  defaultNameAnchor,
} from "@/lib/book/coverLayouts";
import type { StudioSlide } from "@/lib/book/studio";
import { useOurTailTalesStore } from "@/store/useOurTailTalesStore";
import type { CoverFontId } from "@/types/book";
import type { PhotoAsset } from "@/types/photo";

const NAME_SIZES = [
  1, 1.25, 1.5, 1.75, 2, 2.25, 2.5, 2.75, 3, 3.25, 3.5, 3.75, 4, 4.5, 5,
] as const;

const inputClass =
  "w-full rounded-lg border border-page-line bg-white px-3.5 py-2.5 text-sm text-page-ink outline-none transition-colors placeholder:text-page-ink-faint focus:border-periwinkle focus:ring-2 focus:ring-periwinkle/20";

const selectClass =
  "h-10 w-full rounded-lg border border-page-line bg-white px-2.5 text-sm text-page-ink outline-none transition-colors hover:border-periwinkle focus:border-periwinkle focus:ring-2 focus:ring-periwinkle/20";

/**
 * The tools for whichever page is selected — and only those.
 *
 * A single toolbar carrying every control the book might need is unreadable by
 * the third chapter; a panel that shows the four things this page actually has
 * is not. Which page is selected changes on a tap, never on a scroll, so this
 * panel is stable while someone is hunting for a page.
 */
export function PageInspector({
  slide,
  photos,
  onRegenerate,
  onFiles,
  processing,
}: {
  slide: StudioSlide;
  photos: PhotoAsset[];
  onRegenerate: (chapterId: string) => void;
  onFiles: (files: File[]) => void;
  processing: boolean;
}) {
  if (!slide.editable) {
    return (
      <Panel
        title={slide.label}
        hint="This page is part of the binding, not the story. Nothing to change here."
      />
    );
  }

  if (!slide.page) {
    return <CoverPanel photos={photos} onFiles={onFiles} processing={processing} />;
  }

  switch (slide.page.kind) {
    case "title":
      return <TitlePanel photos={photos} />;
    case "dedication":
      return <DedicationPanel />;
    case "chapter-opener":
      return (
        <ChapterPanel
          chapterId={slide.chapterId!}
          photos={photos}
          onRegenerate={onRegenerate}
        />
      );
    case "closing":
      return (
        <Panel
          title="Closing"
          hint="The last page uses a photo from the final chapter. Change that chapter's photos and this follows."
        />
      );
    default:
      return <PhotoPagePanel slide={slide} photos={photos} />;
  }
}

/* ---------------------------------- cover --------------------------------- */

function CoverPanel({
  photos,
  onFiles,
  processing,
}: {
  photos: PhotoAsset[];
  onFiles: (files: File[]) => void;
  processing: boolean;
}) {
  const meta = useOurTailTalesStore((state) => state.meta);
  const setMeta = useOurTailTalesStore((state) => state.setMeta);
  const setCoverPhoto = useOurTailTalesStore((state) => state.setCoverPhoto);
  const customCover = useOurTailTalesStore((state) => state.customCover);
  const [showUpload, setShowUpload] = useState(false);

  const layoutId = meta.coverLayoutId ?? DEFAULT_COVER_LAYOUT;
  const fontId = meta.coverFontId ?? DEFAULT_COVER_FONT;
  const anchor = meta.coverNameAnchor ?? defaultNameAnchor(layoutId);
  const nameSize = meta.coverNameSize ?? DEFAULT_COVER_NAME_SIZE;

  return (
    <Panel title="Cover" hint="The first thing anyone sees.">
      <Field label="Pet's name">
        <input
          type="text"
          value={meta.petName}
          onChange={(event) => setMeta({ petName: event.target.value.slice(0, 60) })}
          placeholder="Type name here"
          className={inputClass}
        />
      </Field>

      <Field label="Style">
        <div className="grid grid-cols-3 gap-2">
          {COVER_LAYOUTS.map((layout) => (
            <LayoutThumbnail
              key={layout.id}
              layoutId={layout.id}
              petName={meta.petName || "Type name here"}
              active={layoutId === layout.id}
              onClick={() => setMeta({ coverLayoutId: layout.id })}
            />
          ))}
        </div>
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Font">
          <select
            value={fontId}
            onChange={(event) =>
              setMeta({ coverFontId: event.target.value as CoverFontId })
            }
            className={selectClass}
            aria-label="Name font"
          >
            {COVER_FONTS.map((font) => (
              <option key={font.id} value={font.id}>
                {font.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Size">
          <select
            value={nameSize}
            onChange={(event) => setMeta({ coverNameSize: Number(event.target.value) })}
            className={selectClass}
            aria-label="Name size"
          >
            {NAME_SIZES.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <Field label="Name position">
        <NamePositionPicker
          value={anchor}
          onChange={(next) => setMeta({ coverNameAnchor: next })}
        />
      </Field>

      <Field label="Cover photo">
        <PhotoPicker
          photos={photos}
          selectedId={meta.coverPhotoId}
          onPick={setCoverPhoto}
          badge="Cover"
        />
        <div className="mt-3">
          <AddMediaControl
            onFiles={onFiles}
            processing={processing}
            readyCount={photos.length}
            videoCount={0}
          />
        </div>
      </Field>

      {/* The customer's own print-ready wrap, if they have one. Kept behind a
          disclosure because almost nobody does, and an upload field sitting
          open next to a finished cover reads as though one is expected. */}
      <div className="border-t border-page-line pt-4">
        <button
          type="button"
          onClick={() => setShowUpload((open) => !open)}
          aria-expanded={showUpload}
          className="text-xs font-medium text-page-ink-soft underline decoration-page-line underline-offset-4 hover:text-periwinkle-deep"
        >
          {customCover
            ? "Your uploaded cover is in use. Manage it"
            : "I have my own print-ready cover"}
        </button>
        {showUpload || customCover ? (
          <div className="mt-3">
            <CustomCoverPanel />
          </div>
        ) : null}
      </div>
    </Panel>
  );
}

/* ---------------------------------- title --------------------------------- */

function TitlePanel({ photos }: { photos: PhotoAsset[] }) {
  const meta = useOurTailTalesStore((state) => state.meta);
  const setMeta = useOurTailTalesStore((state) => state.setMeta);
  const setCoverPhoto = useOurTailTalesStore((state) => state.setCoverPhoto);

  return (
    <Panel title="Title page" hint="The first page inside the book.">
      <Field label="Pet's name">
        <input
          type="text"
          value={meta.petName}
          onChange={(event) => setMeta({ petName: event.target.value.slice(0, 60) })}
          placeholder="Type name here"
          className={inputClass}
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="From">
          <input
            type="text"
            inputMode="numeric"
            value={meta.birthYear}
            onChange={(event) => setMeta({ birthYear: digitsOnly(event.target.value) })}
            placeholder="2011"
            className={inputClass}
          />
        </Field>
        <Field label="Until">
          <input
            type="text"
            inputMode="numeric"
            value={meta.deathYear}
            onChange={(event) => setMeta({ deathYear: digitsOnly(event.target.value) })}
            placeholder="2024"
            className={inputClass}
          />
        </Field>
      </div>

      {/* The three answers that shaped the writing rather than the page.
          Editable here so nothing collected before the upload is stuck —
          change one and rewrite a chapter from its own panel to hear it. */}
      <Field
        label="What they are"
        note="Rewrite a chapter afterwards to hear the difference."
      >
        <input
          type="text"
          value={meta.species ?? ""}
          onChange={(event) => setMeta({ species: event.target.value.slice(0, 40) })}
          placeholder="Dog"
          className={inputClass}
        />
      </Field>

      <Field label="Still with you">
        <div className="flex gap-2">
          <Toggle
            label="Yes"
            active={meta.stillHere === true}
            onClick={() => setMeta({ stillHere: true, deathYear: "" })}
          />
          <Toggle
            label="No"
            active={meta.stillHere === false}
            onClick={() => setMeta({ stillHere: false })}
          />
        </div>
      </Field>

      <Field label="What we should know about them">
        <textarea
          value={meta.notes ?? ""}
          onChange={(event) => setMeta({ notes: event.target.value.slice(0, 240) })}
          rows={3}
          placeholder="Terrified of the vacuum. Would swim in anything."
          className={`${inputClass} resize-none leading-relaxed`}
        />
      </Field>

      {/* Here as well as on its own page: with no dedication there is no
          dedication page, so this is the only way to add one back. */}
      <Field
        label={`Dedication · ${meta.dedication.length}/320`}
        note="Optional. Leave it empty and the book has no dedication page."
      >
        <textarea
          value={meta.dedication}
          onChange={(event) => setMeta({ dedication: event.target.value.slice(0, 320) })}
          rows={3}
          placeholder="For the best copilot a family could ask for."
          className={`${inputClass} resize-none leading-relaxed`}
        />
      </Field>

      <Field
        label="Photo"
        note="The title page uses the cover photo. Changing it here changes both."
      >
        <PhotoPicker
          photos={photos}
          selectedId={meta.coverPhotoId}
          onPick={setCoverPhoto}
          badge="In use"
        />
      </Field>
    </Panel>
  );
}

/* -------------------------------- dedication ------------------------------ */

function DedicationPanel() {
  const meta = useOurTailTalesStore((state) => state.meta);
  const setMeta = useOurTailTalesStore((state) => state.setMeta);

  return (
    <Panel
      title="Dedication"
      hint="A line or two of your own. It also goes on the back cover."
    >
      <Field label={`Dedication · ${meta.dedication.length}/320`}>
        <textarea
          value={meta.dedication}
          onChange={(event) => setMeta({ dedication: event.target.value.slice(0, 320) })}
          rows={6}
          placeholder="For the best copilot a family could ask for."
          className={`${inputClass} resize-none leading-relaxed`}
        />
      </Field>
    </Panel>
  );
}

/* --------------------------------- chapter -------------------------------- */

function ChapterPanel({
  chapterId,
  photos,
  onRegenerate,
}: {
  chapterId: string;
  photos: PhotoAsset[];
  onRegenerate: (chapterId: string) => void;
}) {
  const chapter = useOurTailTalesStore((state) =>
    state.chapters.find((entry) => entry.id === chapterId),
  );
  const updateChapterText = useOurTailTalesStore((state) => state.updateChapterText);
  const setChapterHero = useOurTailTalesStore((state) => state.setChapterHero);

  const chapterPhotos = useMemo(
    () =>
      chapter
        ? chapter.photoIds
            .map((id) => photos.find((photo) => photo.id === id))
            .filter((photo): photo is PhotoAsset => Boolean(photo))
        : [],
    [chapter, photos],
  );

  if (!chapter) return null;
  const writing = chapter.aiStatus === "pending";

  return (
    <Panel title="Chapter" hint="All of this is yours to change.">
      {chapter.aiStatus === "error" ? (
        // Was a lavender box in the same muted grey as every hint on the
        // panel, with nothing pointing at the retry sitting below it. A
        // chapter that failed is the one thing on this screen somebody has to
        // act on.
        <p
          role="alert"
          className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-xs leading-5 text-red-800"
        >
          {chapter.aiError ?? "This chapter could not be written."}{" "}
          Use <span className="font-semibold">Write this chapter again</span>{" "}
          below, or write it yourself.
        </p>
      ) : null}

      <Field label="Title">
        <input
          type="text"
          value={chapter.title}
          onChange={(event) =>
            updateChapterText(chapter.id, { title: event.target.value.slice(0, 90) })
          }
          className={inputClass}
        />
      </Field>

      <Field label="Date line">
        <input
          type="text"
          value={chapter.dateLabel}
          onChange={(event) =>
            updateChapterText(chapter.id, { dateLabel: event.target.value.slice(0, 60) })
          }
          placeholder="Summer 2019"
          className={inputClass}
        />
      </Field>

      <Field label="Story">
        <textarea
          value={chapter.blurb}
          onChange={(event) =>
            updateChapterText(chapter.id, { blurb: event.target.value.slice(0, 1200) })
          }
          rows={7}
          className={`${inputClass} resize-none leading-relaxed`}
        />
      </Field>

      <button
        type="button"
        onClick={() => onRegenerate(chapter.id)}
        disabled={writing}
        className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-page-line bg-white px-3.5 text-sm font-medium text-page-ink-soft transition-colors hover:border-periwinkle hover:text-periwinkle-deep disabled:cursor-not-allowed disabled:opacity-60"
      >
        <RefreshCw
          aria-hidden
          className={`size-4 ${writing ? "animate-spin" : ""}`}
        />
        {writing ? "Writing…" : "Write this chapter again"}
      </button>

      <Field label="Opening photo">
        <PhotoPicker
          photos={chapterPhotos}
          selectedId={chapter.heroPhotoId}
          onPick={(photoId) => setChapterHero(chapter.id, photoId)}
          badge="Opens"
          emptyLabel="This chapter has no photos yet."
        />
      </Field>
    </Panel>
  );
}

/* ------------------------------- photo pages ------------------------------ */

function PhotoPagePanel({
  slide,
  photos,
}: {
  slide: StudioSlide;
  photos: PhotoAsset[];
}) {
  const chapters = useOurTailTalesStore((state) => state.chapters);
  const swapChapterPhoto = useOurTailTalesStore((state) => state.swapChapterPhoto);

  const page = slide.page!;
  const chapter = chapters.find((entry) => entry.id === slide.chapterId);
  const [slotIndex, setSlotIndex] = useState(0);

  const onPage = useMemo(
    () =>
      page.photoIds
        .map((id) => photos.find((photo) => photo.id === id))
        .filter((photo): photo is PhotoAsset => Boolean(photo)),
    [page.photoIds, photos],
  );

  // Anything from this chapter's date range that is not already on a page.
  const available = useMemo(() => {
    if (!chapter) return [];
    const used = new Set(chapter.photoIds);
    const pool = chapter.candidateIds.filter((id) => !used.has(id));
    const current = page.photoIds[slotIndex];
    return [current, ...pool]
      .filter((id): id is string => Boolean(id))
      .map((id) => photos.find((photo) => photo.id === id))
      .filter((photo): photo is PhotoAsset => Boolean(photo));
  }, [chapter, page.photoIds, photos, slotIndex]);

  if (onPage.length === 0) {
    return (
      <Panel
        title={slide.label}
        hint="This page has no photos on it. The chapter ran out before reaching it."
      />
    );
  }

  const active = page.photoIds[slotIndex];

  return (
    <Panel title={slide.label} hint="Swap any photo on this page.">
      <Field label="Photo on this page">
        <ol className="flex gap-2">
          {onPage.map((photo, index) => (
            <li key={photo.id}>
              <button
                type="button"
                onClick={() => setSlotIndex(index)}
                aria-pressed={index === slotIndex}
                className={`block size-14 overflow-hidden rounded-md ring-1 transition-all ${
                  index === slotIndex
                    ? "ring-2 ring-periwinkle"
                    : "ring-page-ink/10 hover:ring-periwinkle/60"
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- local object URL */}
                <img
                  src={photo.thumbUrl}
                  alt=""
                  className="h-full w-full object-cover"
                />
              </button>
            </li>
          ))}
        </ol>
      </Field>

      <Field label="Replace it with">
        <PhotoPicker
          photos={available}
          selectedId={active ?? null}
          onPick={(incoming) => {
            if (!chapter || !active || incoming === active) return;
            swapChapterPhoto(chapter.id, active, incoming);
          }}
          badge="On page"
          emptyLabel="Every photo from this part of the album is already in the book."
        />
      </Field>
    </Panel>
  );
}

/* --------------------------------- pieces --------------------------------- */

function Panel({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-display text-lg text-page-ink">{title}</h2>
        {hint ? <p className="mt-1 text-xs leading-5 text-page-ink-faint">{hint}</p> : null}
      </div>
      {children}
    </div>
  );
}

function Toggle({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`min-h-10 flex-1 rounded-lg border px-3 text-sm font-medium transition-colors ${
        active
          ? "border-periwinkle bg-periwinkle text-white"
          : "border-page-line bg-white text-page-ink-soft hover:border-periwinkle hover:text-periwinkle-deep"
      }`}
    >
      {label}
    </button>
  );
}

/** Years only — a date picker for a birth year nobody is certain of is worse. */
function digitsOnly(value: string): string {
  return value.replace(/\D/g, "").slice(0, 4);
}

/**
 * A labelled control.
 *
 * The label used to be a `<span>`, which is not a label: every text field in
 * the editor — the pet's name, the years, the notes, the dedication, every
 * chapter title and story — announced as "edit text, blank" to anyone not
 * looking at the screen, and tapping the label did nothing.
 *
 * Where the child is a single form control it is given an id and a real
 * `<label>` is tied to it. Where it is a group of buttons or a picker there is
 * nothing to tie a label to, and one would steal the click, so those keep a
 * plain caption. The distinction is made here rather than at twenty call
 * sites, which is how it drifted in the first place.
 */
const LABELLABLE = new Set(["input", "textarea", "select"]);

function Field({
  label,
  note,
  children,
}: {
  label: string;
  note?: string;
  children: React.ReactNode;
}) {
  const generated = useId();

  const control =
    isValidElement(children) &&
    typeof children.type === "string" &&
    LABELLABLE.has(children.type)
      ? cloneElement(children as React.ReactElement<{ id?: string }>, {
          id: (children.props as { id?: string }).id ?? generated,
        })
      : null;

  const id = control
    ? ((control.props as { id?: string }).id ?? generated)
    : null;

  return (
    <div>
      {id ? (
        <label
          htmlFor={id}
          className="mb-1.5 block text-sm font-medium text-page-ink-soft"
        >
          {label}
        </label>
      ) : (
        <span className="mb-1.5 block text-sm font-medium text-page-ink-soft">
          {label}
        </span>
      )}
      {control ?? children}
      {note ? (
        <p className="mt-1.5 flex items-start gap-1.5 text-[0.7rem] leading-4 text-page-ink-faint">
          <Info aria-hidden className="mt-px size-3 shrink-0" />
          {note}
        </p>
      ) : null}
    </div>
  );
}
