"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { AlertCircle, CheckCircle2 } from "lucide-react";

import { BackCoverArt, coverImageUrl } from "@/components/book-viewer/CoverArt";
import { CoverLayoutChrome } from "@/components/book-viewer/CoverLayoutChrome";
import { AddMediaControl } from "@/components/editor/AddMediaControl";
import { CustomCoverPanel } from "@/components/editor/CustomCoverPanel";
import { LayoutThumbnail } from "@/components/editor/LayoutThumbnail";
import { useOurTailTalesStore } from "@/store/useOurTailTalesStore";
import {
  COVER_FONTS,
  COVER_LAYOUTS,
  COVER_NAME_ANCHORS,
  DEFAULT_COVER_FONT,
  DEFAULT_COVER_LAYOUT,
  DEFAULT_COVER_NAME_SIZE,
  coverFontVar,
  coverTextTone,
  defaultNameAnchor,
  styleForAnchor,
} from "@/lib/book/coverLayouts";
import { buildCustomCoverCrops, type CustomCoverCrops } from "@/lib/book/customCoverPreview";
import { getCustomCoverFile } from "@/lib/book/customCoverStore";
import { getFullUrl } from "@/lib/photo/assetStore";
import { selectablePhotos } from "@/lib/photo/dedupe";
import { isLikelyMedia } from "@/lib/photo/process";
import type { BookMeta, CoverFontId, CoverNameAnchor } from "@/types/book";
import type { PhotoAsset } from "@/types/photo";

/** Selectable cover-name sizes (rem) — a wider range at a finer step than before. */
const NAME_SIZES = [
  1, 1.25, 1.5, 1.75, 2, 2.25, 2.5, 2.75, 3, 3.25, 3.5, 3.75, 4, 4.5, 5,
] as const;

const inputClass =
  "w-full rounded-lg border border-page-line bg-white px-3.5 py-2.5 text-page-ink outline-none transition-colors placeholder:text-page-ink-faint focus:border-periwinkle focus:ring-2 focus:ring-periwinkle/20";

const selectClass =
  "h-10 w-full rounded-lg border border-page-line bg-white px-2.5 text-sm text-page-ink outline-none transition-colors hover:border-periwinkle focus:border-periwinkle focus:ring-2 focus:ring-periwinkle/20";

type CoverTab = "front" | "back" | "upload";

/**
 * Cover editor: a tab group (Front cover / Back cover / Upload cover) drives
 * both the canvas and the tool panel below it. Each tab carries its own
 * done/not-done indicator — a checkmark once that side has what it needs, an
 * exclamation mark while it doesn't — and the upload tab is flagged
 * "(optional)" since a customer only needs it if they're supplying their own
 * print-ready cover instead of the in-app design.
 */
export function CoverEditor({
  meta,
  photos,
  onMetaChange,
  onSetCover,
  onFiles,
  processing,
  readyCount,
  videoCount,
}: {
  meta: BookMeta;
  photos: PhotoAsset[];
  onMetaChange: (patch: Partial<BookMeta>) => void;
  onSetCover: (photoId: string) => void;
  onFiles: (files: File[]) => void;
  processing: boolean;
  readyCount: number;
  videoCount: number;
}) {
  const [tab, setTab] = useState<CoverTab>("front");
  const customCover = useOurTailTalesStore((state) => state.customCover);
  const pickable = selectablePhotos(photos);
  const photoUrl = coverImageUrl(photos, meta.coverPhotoId);

  const layoutId = meta.coverLayoutId ?? DEFAULT_COVER_LAYOUT;
  const textOnLight = coverTextTone(layoutId) === "dark";
  const fontId = meta.coverFontId ?? DEFAULT_COVER_FONT;
  const anchor = meta.coverNameAnchor ?? defaultNameAnchor(layoutId);
  const nameStyle = styleForAnchor(anchor);
  const nameSize = meta.coverNameSize ?? DEFAULT_COVER_NAME_SIZE;
  const nameBold = meta.coverNameBold ?? true;
  const petName = meta.petName.trim();

  // Lets the empty-cover placeholder on the canvas act as its own upload CTA,
  // instead of just naming what's missing.
  const canvasUploadInputRef = useRef<HTMLInputElement>(null);
  const handleCanvasUploadChange = (event: ChangeEvent<HTMLInputElement>): void => {
    const files = Array.from(event.target.files ?? []).filter(isLikelyMedia);
    event.target.value = "";
    if (files.length > 0) onFiles(files);
  };

  // A customer-uploaded cover already contains the front and back — they
  // don't need to also fill in the in-app design for either to count as done.
  const uploadDone = Boolean(customCover);
  const frontDone = uploadDone || (Boolean(photoUrl) && Boolean(petName));
  const backDone = uploadDone || meta.dedication.trim().length > 0;

  // Once a custom cover is uploaded, the Front/Back tabs preview what's
  // actually inside that file — cropped from it — instead of the in-app
  // design, so the customer sees what will really print. Re-crops whenever
  // the uploaded file changes (new upload, re-check, or removal), keyed on
  // the file's own identity so a stale result never gets attributed to a
  // newer (or removed) upload while the effect is still resetting state —
  // the effect only ever calls setState from inside the async callback, per
  // the rules of hooks, and this key comparison is what lets "no upload" or
  // "a different upload" be derived instead of needing a synchronous reset.
  const customCoverKey = customCover
    ? `${customCover.fileName}:${customCover.sizeBytes}:${customCover.validatedForPages}`
    : null;
  const [cropResult, setCropResult] = useState<
    | { key: string; status: "ready"; crops: CustomCoverCrops }
    | { key: string; status: "error" }
    | null
  >(null);

  useEffect(() => {
    if (!customCoverKey || !customCover) return;
    const file = getCustomCoverFile();
    if (!file) return;
    let cancelled = false;
    buildCustomCoverCrops(file, { width: customCover.widthPt, height: customCover.heightPt })
      .then((crops) => {
        if (!cancelled) setCropResult({ key: customCoverKey, status: "ready", crops });
      })
      .catch(() => {
        if (!cancelled) setCropResult({ key: customCoverKey, status: "error" });
      });
    return () => {
      cancelled = true;
    };
  }, [customCoverKey, customCover]);

  const customCoverCrops =
    cropResult && cropResult.key === customCoverKey && cropResult.status === "ready"
      ? cropResult.crops
      : null;
  const customCoverCropError = Boolean(
    cropResult && cropResult.key === customCoverKey && cropResult.status === "error",
  );

  return (
    <section>
      <div className="mb-5 inline-flex flex-wrap gap-0.5 rounded-lg border border-page-line bg-white p-0.5 text-sm">
        <CoverTabButton
          label="Front cover"
          active={tab === "front"}
          done={frontDone}
          onClick={() => setTab("front")}
        />
        <CoverTabButton
          label="Back cover"
          active={tab === "back"}
          done={backDone}
          onClick={() => setTab("back")}
        />
        <CoverTabButton
          label="Upload cover"
          suffix="(optional)"
          active={tab === "upload"}
          done={uploadDone}
          onClick={() => setTab("upload")}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_26rem] lg:items-start">
        {tab !== "upload" ? (
          <div className="relative aspect-square w-full">
            <div className="@container relative h-full w-full overflow-hidden rounded-xl shadow-book">
              {customCover ? (
                <CustomCoverPreviewPane
                  url={tab === "front" ? customCoverCrops?.frontUrl : customCoverCrops?.backUrl}
                  error={customCoverCropError}
                  side={tab === "front" ? "front" : "back"}
                />
              ) : tab === "front" ? (
                <>
                  <input
                    ref={canvasUploadInputRef}
                    type="file"
                    accept="image/*,video/*"
                    multiple
                    className="sr-only"
                    onChange={handleCanvasUploadChange}
                  />
                  <CoverLayoutChrome
                    layoutId={layoutId}
                    photoUrl={photoUrl}
                    onUploadClick={
                      photoUrl ? undefined : () => canvasUploadInputRef.current?.click()
                    }
                  />
                  {(photoUrl || !meta.coverPhotoId) && petName ? (
                    <p
                      className={`absolute z-10 max-w-[82%] leading-[1.05] ${
                        textOnLight ? "text-ink" : "text-white"
                      }`}
                      style={{
                        ...nameStyle,
                        fontFamily: coverFontVar(fontId),
                        fontSize: `clamp(1rem, ${nameSize * 2.5}cqw, ${nameSize * 1.25}rem)`,
                        fontWeight: nameBold ? 700 : 400,
                        textShadow: textOnLight
                          ? "0 1px 3px rgba(255,255,255,0.55)"
                          : "0 1px 4px rgba(15,17,23,0.55)",
                      }}
                    >
                      {petName}
                    </p>
                  ) : null}
                </>
              ) : (
                <div className="h-full w-full bg-[#e4ddd0]">
                  <BackCoverArt dedication={meta.dedication} />
                </div>
              )}
            </div>
          </div>
        ) : null}

        {/* Tool panel: full width on the Upload tab, sharing the row otherwise */}
        <div className={`space-y-4 ${tab === "upload" ? "lg:col-span-2" : ""}`}>
          {customCover && tab !== "upload" ? (
            <p className="rounded-xl border border-periwinkle/30 bg-periwinkle-wash/40 px-4 py-3 text-sm text-page-ink-soft">
              You have an uploaded cover in use for printing — this design won&rsquo;t be used
              unless you remove it from the &ldquo;Upload cover&rdquo; tab.
            </p>
          ) : null}

          {tab === "front" && (
            <>
              <div>
                <h3 className="font-display text-lg text-page-ink">Front cover</h3>
                <p className="mt-1 text-xs text-page-ink-faint">
                  Pick a layout, choose the cover photo, and add your pet&rsquo;s name.
                </p>
              </div>

              <div className="grid grid-cols-3 gap-2">
                {COVER_LAYOUTS.map((layout) => (
                  <LayoutThumbnail
                    key={layout.id}
                    layoutId={layout.id}
                    petName={petName || "Type name here"}
                    active={layoutId === layout.id}
                    onClick={() => onMetaChange({ coverLayoutId: layout.id })}
                  />
                ))}
              </div>

              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-page-ink-soft">
                  Pet&rsquo;s name
                </span>
                <input
                  type="text"
                  value={meta.petName}
                  onChange={(event) =>
                    onMetaChange({ petName: event.target.value.slice(0, 60) })
                  }
                  placeholder="Type name here"
                  className={inputClass}
                />
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium text-page-ink-soft">
                    Font
                  </span>
                  <select
                    value={fontId}
                    onChange={(event) =>
                      onMetaChange({ coverFontId: event.target.value as CoverFontId })
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
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium text-page-ink-soft">
                    Size
                  </span>
                  <select
                    value={nameSize}
                    onChange={(event) =>
                      onMetaChange({ coverNameSize: Number(event.target.value) })
                    }
                    className={selectClass}
                    aria-label="Name size"
                  >
                    {NAME_SIZES.map((size) => (
                      <option key={size} value={size}>
                        {size}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div>
                <span className="mb-1.5 block text-sm font-medium text-page-ink-soft">
                  Name position
                </span>
                <NamePositionPicker
                  value={anchor}
                  onChange={(nextAnchor) => onMetaChange({ coverNameAnchor: nextAnchor })}
                />
              </div>

              <AddMediaControl
                onFiles={onFiles}
                processing={processing}
                readyCount={readyCount}
                videoCount={videoCount}
              />

              <MediaPanel
                photos={pickable}
                coverPhotoId={meta.coverPhotoId}
                photoUrl={photoUrl}
                onSetCover={onSetCover}
              />
            </>
          )}

          {tab === "back" && (
            <>
              <div>
                <h3 className="font-display text-lg text-page-ink">Back cover</h3>
                <p className="mt-1 text-xs text-page-ink-faint">
                  Add a short dedication — it also appears on the dedication page inside the
                  book.
                </p>
              </div>
              <label className="block">
                <span className="mb-1.5 flex items-baseline justify-between text-sm font-medium text-page-ink-soft">
                  <span>Dedication</span>
                  <span className="text-xs font-normal text-page-ink-faint">
                    {meta.dedication.length}/320
                  </span>
                </span>
                <textarea
                  value={meta.dedication}
                  onChange={(event) =>
                    onMetaChange({ dedication: event.target.value.slice(0, 320) })
                  }
                  rows={8}
                  placeholder="For the best copilot a family could ask for."
                  className={`${inputClass} resize-none leading-relaxed`}
                />
              </label>
            </>
          )}

          {tab === "upload" && (
            <>
              <div>
                <h3 className="font-display text-lg text-page-ink">Upload your own cover</h3>
                <p className="mt-1 max-w-2xl text-xs text-page-ink-faint">
                  Already have a print-ready front, spine, and back cover? Upload it here —
                  when present, it&rsquo;s used for printing instead of the Front/Back design.
                  Entirely optional.
                </p>
              </div>
              <div className="max-w-xl">
                <CustomCoverPanel />
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────── Custom cover preview ─────────────────────── */

/** Shows the front or back panel cropped from the customer's uploaded cover file, in place of the in-app design, while it renders (or if it couldn't be). */
function CustomCoverPreviewPane({
  url,
  error,
  side,
}: {
  url: string | undefined;
  error: boolean;
  side: "front" | "back";
}) {
  if (error) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-[#e4ddd0] px-6 text-center text-sm text-page-ink-faint">
        Couldn&rsquo;t preview the uploaded {side} cover here — it&rsquo;s still what will print.
      </div>
    );
  }
  if (!url) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-[#e4ddd0] text-sm text-page-ink-faint">
        Loading your uploaded cover&hellip;
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element -- local data URL crop
    <img
      src={url}
      alt={`${side === "front" ? "Front" : "Back"} cover, from your uploaded file`}
      className="h-full w-full object-cover"
    />
  );
}

/* ─────────────────────── Tab button ─────────────────────── */

function CoverTabButton({
  label,
  suffix,
  active,
  done,
  onClick,
}: {
  label: string;
  suffix?: string;
  active: boolean;
  done: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`flex items-center gap-1.5 rounded-md px-3.5 py-1.5 font-medium transition-colors ${
        active
          ? "bg-periwinkle text-white"
          : "text-page-ink-soft hover:text-periwinkle-deep"
      }`}
    >
      {done ? (
        <CheckCircle2
          className={`h-3.5 w-3.5 shrink-0 ${active ? "text-white" : "text-emerald-600"}`}
          aria-hidden
        />
      ) : (
        <AlertCircle
          className={`h-3.5 w-3.5 shrink-0 ${active ? "text-white" : "text-amber-500"}`}
          aria-hidden
        />
      )}
      <span>
        {label}
        {suffix ? (
          <span className={active ? "text-white/80" : "text-page-ink-faint"}> {suffix}</span>
        ) : null}
      </span>
    </button>
  );
}

/* ─────────────────────── Name position picker ─────────────────────── */

/** 3×3 grid of anchor choices — same "pick a tile" pattern as the layout grid above. */
function NamePositionPicker({
  value,
  onChange,
}: {
  value: CoverNameAnchor;
  onChange: (anchor: CoverNameAnchor) => void;
}) {
  return (
    <div className="grid grid-cols-3 gap-1.5 rounded-lg border border-page-line bg-white p-2">
      {COVER_NAME_ANCHORS.map((option) => {
        const active = value === option.id;
        return (
          <button
            key={option.id}
            type="button"
            onClick={() => onChange(option.id)}
            title={option.label}
            aria-label={option.label}
            aria-pressed={active}
            className={`relative aspect-square rounded-md border transition-colors ${
              active
                ? "border-periwinkle bg-periwinkle/10"
                : "border-page-line/70 hover:border-periwinkle/50 hover:bg-periwinkle/5"
            }`}
          >
            <span
              aria-hidden
              className={`absolute h-1.5 w-1.5 rounded-full transition-colors ${
                active ? "bg-periwinkle" : "bg-page-ink/25"
              }`}
              style={{
                left: `${option.dot.x}%`,
                top: `${option.dot.y}%`,
                transform: "translate(-50%, -50%)",
              }}
            />
          </button>
        );
      })}
    </div>
  );
}

/* ─────────────────────── Media panel ─────────────────────── */

function MediaPanel({
  photos,
  coverPhotoId,
  photoUrl,
  onSetCover,
}: {
  photos: PhotoAsset[];
  coverPhotoId: string | null;
  photoUrl: string | null;
  onSetCover: (photoId: string) => void;
}) {
  return (
    <div className="space-y-3">
      <p className="text-xs font-medium text-ink-soft">
        Click a photo to use it on the cover.
      </p>
      <ol className="grid grid-cols-3 gap-2">
        {photos.map((photo) => {
          const isCover = coverPhotoId
            ? coverPhotoId === photo.id
            : photoUrl === photo.thumbUrl;
          // Use full-quality URL for the media picker
          const displayUrl = getFullUrl(photo.id) ?? photo.thumbUrl;
          return (
            <li key={photo.id} className="relative">
              <button
                type="button"
                onClick={() => onSetCover(photo.id)}
                className={`block w-full overflow-hidden rounded-md ring-1 transition-all ${
                  isCover
                    ? "ring-2 ring-periwinkle"
                    : "ring-ink/10 hover:ring-periwinkle/60"
                }`}
                title="Use as cover"
              >
                <span className="block aspect-square">
                  {/* eslint-disable-next-line @next/next/no-img-element -- local object URL */}
                  <img
                    src={displayUrl}
                    alt=""
                    loading="lazy"
                    className="h-full w-full object-cover"
                  />
                </span>
              </button>
              {isCover && (
                <span className="pointer-events-none absolute left-1 top-1 rounded bg-ink/75 px-1 py-0.5 text-[9px] uppercase tracking-wide text-white">
                  Cover
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
