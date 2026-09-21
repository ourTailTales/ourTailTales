"use client";

import {
  useCallback,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";

import { coverImageUrl } from "@/components/book-viewer/CoverArt";
import { CoverLayoutChrome } from "@/components/book-viewer/CoverLayoutChrome";
import { LayoutThumbnail } from "@/components/editor/LayoutThumbnail";
import {
  COVER_FONTS,
  COVER_LAYOUTS,
  DEFAULT_COVER_FONT,
  DEFAULT_COVER_LAYOUT,
  clampCoverPosition,
  coverFontVar,
  defaultDatesPos,
  defaultNamePos,
} from "@/lib/book/coverLayouts";
import { getFullUrl } from "@/lib/photo/assetStore";
import { selectablePhotos } from "@/lib/photo/dedupe";
import type {
  BookMeta,
  CoverFontId,
  CoverPosition,
  CoverTextField,
} from "@/types/book";
import type { PhotoAsset } from "@/types/photo";

/** Available cover-name font sizes (rem). */
const NAME_SIZES = [1.25, 1.5, 1.75, 2, 2.25, 2.5, 2.75] as const;
const DEFAULT_NAME_SIZE = 2;

type ToolTab = "text" | "media";

/** Which field on the cover is currently selected for editing. */
type SelectedField =
  | { kind: "name" }
  | { kind: "years" }
  | { kind: "extra"; id: string }
  | null;

export function CoverEditor({
  meta,
  photos,
  onMetaChange,
  onSetCover,
}: {
  meta: BookMeta;
  photos: PhotoAsset[];
  onMetaChange: (patch: Partial<BookMeta>) => void;
  onSetCover: (photoId: string) => void;
}) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const pickable = selectablePhotos(photos);
  const photoUrl = coverImageUrl(photos, meta.coverPhotoId);

  const layoutId = meta.coverLayoutId ?? DEFAULT_COVER_LAYOUT;
  const fontId = meta.coverFontId ?? DEFAULT_COVER_FONT;
  const namePos = meta.coverNamePos ?? defaultNamePos(layoutId);
  const datesPos = meta.coverDatesPos ?? defaultDatesPos(layoutId);
  const nameSize = meta.coverNameSize ?? DEFAULT_NAME_SIZE;
  const nameBold = meta.coverNameBold ?? true;
  const nameUnderline = meta.coverNameUnderline ?? false;
  const extraFields = meta.coverExtraFields ?? [];

  const petName = meta.petName.trim();
  const years = lifespanText(meta);

  const [activeTab, setActiveTab] = useState<ToolTab>("text");
  const [selected, setSelected] = useState<SelectedField>(null);
  const [editingField, setEditingField] = useState<string | null>(null);

  /* ── field selection helpers ── */

  const selectedFontId = selected
    ? selected.kind === "extra"
      ? extraFields.find((f) => f.id === selected.id)?.fontId ?? fontId
      : fontId
    : fontId;

  const selectedSize = selected
    ? selected.kind === "extra"
      ? extraFields.find((f) => f.id === selected.id)?.size ?? DEFAULT_NAME_SIZE
      : nameSize
    : nameSize;

  const selectedBold = selected
    ? selected.kind === "extra"
      ? extraFields.find((f) => f.id === selected.id)?.bold ?? true
      : nameBold
    : nameBold;

  const selectedUnderline = selected
    ? selected.kind === "extra"
      ? extraFields.find((f) => f.id === selected.id)?.underline ?? false
      : nameUnderline
    : nameUnderline;

  /* ── position helpers ── */

  const toCanvasPos = useCallback(
    (clientX: number, clientY: number): CoverPosition | null => {
      const bounds = canvasRef.current?.getBoundingClientRect();
      if (!bounds) return null;
      return clampCoverPosition({
        x: ((clientX - bounds.left) / bounds.width) * 100,
        y: ((clientY - bounds.top) / bounds.height) * 100,
      });
    },
    [],
  );

  function moveField(field: "coverNamePos" | "coverDatesPos", clientX: number, clientY: number) {
    const pos = toCanvasPos(clientX, clientY);
    if (pos) onMetaChange({ [field]: pos });
  }

  function nudgeField(field: "coverNamePos" | "coverDatesPos", current: CoverPosition, dx: number, dy: number) {
    onMetaChange({ [field]: clampCoverPosition({ x: current.x + dx, y: current.y + dy }) });
  }

  function moveExtraField(id: string, clientX: number, clientY: number) {
    const pos = toCanvasPos(clientX, clientY);
    if (!pos) return;
    onMetaChange({
      coverExtraFields: extraFields.map((f) => (f.id === id ? { ...f, pos } : f)),
    });
  }

  function nudgeExtraField(id: string, current: CoverPosition, dx: number, dy: number) {
    onMetaChange({
      coverExtraFields: extraFields.map((f) =>
        f.id === id ? { ...f, pos: clampCoverPosition({ x: current.x + dx, y: current.y + dy }) } : f,
      ),
    });
  }

  /* ── toolbar actions (apply to whichever field is selected) ── */

  function applyFont(id: CoverFontId) {
    if (!selected || selected.kind === "years") {
      onMetaChange({ coverFontId: id });
    } else if (selected.kind === "name") {
      onMetaChange({ coverFontId: id });
    } else {
      onMetaChange({
        coverExtraFields: extraFields.map((f) =>
          f.id === selected.id ? { ...f, fontId: id } : f,
        ),
      });
    }
  }

  function applySize(s: number) {
    if (!selected || selected.kind === "name") {
      onMetaChange({ coverNameSize: s });
    } else if (selected.kind === "extra") {
      onMetaChange({
        coverExtraFields: extraFields.map((f) =>
          f.id === selected.id ? { ...f, size: s } : f,
        ),
      });
    }
  }

  function applyBold() {
    if (!selected || selected.kind === "name") {
      onMetaChange({ coverNameBold: !nameBold });
    } else if (selected.kind === "extra") {
      const field = extraFields.find((f) => f.id === selected.id);
      onMetaChange({
        coverExtraFields: extraFields.map((f) =>
          f.id === selected.id ? { ...f, bold: !(field?.bold ?? true) } : f,
        ),
      });
    }
  }

  function applyUnderline() {
    if (!selected || selected.kind === "name") {
      onMetaChange({ coverNameUnderline: !nameUnderline });
    } else if (selected.kind === "extra") {
      const field = extraFields.find((f) => f.id === selected.id);
      onMetaChange({
        coverExtraFields: extraFields.map((f) =>
          f.id === selected.id ? { ...f, underline: !(field?.underline ?? false) } : f,
        ),
      });
    }
  }

  function addTextField() {
    const id = crypto.randomUUID();
    const newField: CoverTextField = {
      id,
      text: "New text",
      pos: { x: 50, y: 50 },
      fontId,
      size: 1.5,
      bold: false,
      underline: false,
    };
    onMetaChange({ coverExtraFields: [...extraFields, newField] });
    setSelected({ kind: "extra", id });
    setEditingField(id);
  }

  function removeTextField(id: string) {
    onMetaChange({ coverExtraFields: extraFields.filter((f) => f.id !== id) });
    if (selected?.kind === "extra" && selected.id === id) setSelected(null);
  }

  function updateExtraText(id: string, text: string) {
    onMetaChange({
      coverExtraFields: extraFields.map((f) => (f.id === id ? { ...f, text } : f)),
    });
  }

return (
    <section>
      {/* ─── Two-column: canvas + tool panel (top-aligned, nothing above) ─── */}
      <div className="grid gap-6 lg:grid-cols-[1fr_26rem] lg:items-start">
        {/* Left: cover canvas (square, 8.5 × 8.5 in) */}
        <div
          ref={canvasRef}
          onClick={() => setSelected(null)}
          className="@container relative aspect-square w-full touch-none select-none overflow-hidden rounded-xl shadow-book"
        >
          <CoverLayoutChrome layoutId={layoutId} photoUrl={photoUrl} />

          {/* Pet name */}
          {(photoUrl || !meta.coverPhotoId) && petName ? (
            <DraggableLabel
              label={petName}
              pos={namePos}
              editing={editingField === "__name__"}
              isSelected={selected?.kind === "name"}
              onSelect={(e) => {
                e.stopPropagation();
                setSelected({ kind: "name" });
                setActiveTab("text");
              }}
              onStartEdit={() => setEditingField("__name__")}
              onEndEdit={(text) => {
                setEditingField(null);
                if (text.trim() && text.trim() !== petName) {
                  onMetaChange({ petName: text.trim() });
                }
              }}
              onDrag={(x, y) => moveField("coverNamePos", x, y)}
              onNudge={(dx, dy) => nudgeField("coverNamePos", namePos, dx, dy)}
              style={{
                fontFamily: coverFontVar(fontId),
                fontSize: `clamp(1rem, ${nameSize * 2.5}cqw, ${nameSize * 1.25}rem)`,
                fontWeight: nameBold ? 700 : 400,
                textDecoration: nameUnderline ? "underline" : "none",
                textUnderlineOffset: "0.15em",
              }}
              className="text-white"
            />
          ) : null}

          {/* Years */}
          {(photoUrl || !meta.coverPhotoId) && years ? (
            <DraggableLabel
              label={years}
              pos={datesPos}
              isSelected={selected?.kind === "years"}
              onSelect={(e) => {
                e.stopPropagation();
                setSelected({ kind: "years" });
              }}
              onDrag={(x, y) => moveField("coverDatesPos", x, y)}
              onNudge={(dx, dy) => nudgeField("coverDatesPos", datesPos, dx, dy)}
              className="text-xs tracking-wide text-white/85"
            />
          ) : null}

          {/* Extra user-added text fields */}
          {extraFields.map((field) => (
            <DraggableLabel
              key={field.id}
              label={field.text}
              pos={field.pos}
              editing={editingField === field.id}
              isSelected={selected?.kind === "extra" && selected.id === field.id}
              onSelect={(e) => {
                e.stopPropagation();
                setSelected({ kind: "extra", id: field.id });
                setActiveTab("text");
              }}
              onStartEdit={() => setEditingField(field.id)}
              onEndEdit={(text) => {
                setEditingField(null);
                if (text.trim()) updateExtraText(field.id, text.trim());
              }}
              onDrag={(x, y) => moveExtraField(field.id, x, y)}
              onNudge={(dx, dy) => nudgeExtraField(field.id, field.pos, dx, dy)}
              style={{
                fontFamily: coverFontVar(field.fontId ?? fontId),
                fontSize: `clamp(0.7rem, ${(field.size ?? 1.5) * 2.5}cqw, ${(field.size ?? 1.5) * 1.25}rem)`,
                fontWeight: (field.bold ?? false) ? 700 : 400,
                textDecoration: (field.underline ?? false) ? "underline" : "none",
                textUnderlineOffset: "0.15em",
              }}
              className="text-white"
            />
          ))}
        </div>

        {/* Right: tool panel — heading, layouts, tabs all here so nothing pushes the panel down */}
        <div className="space-y-4">
          {/* Header */}
          <div>
            <h3 className="font-display text-lg text-page-ink">Cover</h3>
            <p className="mt-1 text-xs text-page-ink-faint">
              Click text to edit, drag to reposition.
            </p>
          </div>

          {/* Layout carousel */}
          <div className="flex snap-x snap-mandatory gap-2 overflow-x-auto pb-1 scrollbar-thin">
            {COVER_LAYOUTS.map((layout) => (
              <LayoutThumbnail
                key={layout.id}
                layoutId={layout.id}
                petName={petName || "Name"}
                active={layoutId === layout.id}
                onClick={() =>
                  onMetaChange({
                    coverLayoutId: layout.id,
                    coverNamePos: defaultNamePos(layout.id),
                    coverDatesPos: defaultDatesPos(layout.id),
                  })
                }
              />
            ))}
          </div>

          {/* Tab bar */}
          <div className="flex gap-1 rounded-lg border border-line bg-white p-1">
            <TabButton active={activeTab === "text"} onClick={() => setActiveTab("text")}>
              Text
            </TabButton>
            <TabButton active={activeTab === "media"} onClick={() => setActiveTab("media")}>
              Media
            </TabButton>
          </div>

          {/* Tab content */}
          {activeTab === "text" && (
            <TextPanel
              fontId={selectedFontId}
              size={selectedSize}
              bold={selectedBold}
              underline={selectedUnderline}
              selectedField={selected}
              extraFields={extraFields}
              onFontChange={applyFont}
              onSizeChange={applySize}
              onBoldToggle={applyBold}
              onUnderlineToggle={applyUnderline}
              onAddField={addTextField}
              onRemoveField={removeTextField}
              onSelectField={setSelected}
            />
          )}

          {activeTab === "media" && (
            <MediaPanel
              photos={pickable}
              coverPhotoId={meta.coverPhotoId}
              photoUrl={photoUrl}
              onSetCover={onSetCover}
            />
          )}
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────── Tab button ─────────────────────── */

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
        active
          ? "bg-periwinkle text-white shadow-sm"
          : "text-ink-soft hover:bg-ink/5"
      }`}
    >
      {children}
    </button>
  );
}

/* ─────────────────────── Text panel ─────────────────────── */

function TextPanel({
  fontId,
  size,
  bold,
  underline,
  selectedField,
  extraFields,
  onFontChange,
  onSizeChange,
  onBoldToggle,
  onUnderlineToggle,
  onAddField,
  onRemoveField,
  onSelectField,
}: {
  fontId: string;
  size: number;
  bold: boolean;
  underline: boolean;
  selectedField: SelectedField;
  extraFields: CoverTextField[];
  onFontChange: (id: CoverFontId) => void;
  onSizeChange: (s: number) => void;
  onBoldToggle: () => void;
  onUnderlineToggle: () => void;
  onAddField: () => void;
  onRemoveField: (id: string) => void;
  onSelectField: (field: SelectedField) => void;
}) {
  return (
    <div className="space-y-4">
      {/* Formatting toolbar */}
      <div className="space-y-3 rounded-lg border border-line bg-white p-3">
        <p className="text-xs font-medium text-ink-soft">
          {selectedField
            ? selectedField.kind === "name"
              ? "Formatting: Name"
              : selectedField.kind === "years"
                ? "Formatting: Years"
                : "Formatting: Text field"
            : "Formatting: Name"}
        </p>

        {/* Font family */}
        <select
          value={fontId}
          onChange={(e) => onFontChange(e.target.value as CoverFontId)}
          className="h-8 w-full rounded border border-line bg-white px-2 text-sm text-ink outline-none transition-colors hover:border-periwinkle focus:border-periwinkle"
          aria-label="Font family"
        >
          {COVER_FONTS.map((font) => (
            <option key={font.id} value={font.id}>
              {font.label}
            </option>
          ))}
        </select>

        {/* Size + Bold + Underline row */}
        <div className="flex items-center gap-2">
          <select
            value={size}
            onChange={(e) => onSizeChange(Number(e.target.value))}
            className="h-8 w-20 rounded border border-line bg-white px-1 text-center text-sm text-ink outline-none transition-colors hover:border-periwinkle focus:border-periwinkle"
            aria-label="Font size"
          >
            {NAME_SIZES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>

          <span className="h-5 w-px bg-line" aria-hidden />

          <button
            type="button"
            onClick={onBoldToggle}
            title="Bold"
            className={`flex h-8 w-8 items-center justify-center rounded text-sm font-bold transition-colors ${
              bold ? "bg-periwinkle text-white" : "text-ink hover:bg-ink/5"
            }`}
            aria-pressed={bold}
            aria-label="Bold"
          >
            B
          </button>

          <button
            type="button"
            onClick={onUnderlineToggle}
            title="Underline"
            className={`flex h-8 w-8 items-center justify-center rounded text-sm transition-colors ${
              underline ? "bg-periwinkle text-white" : "text-ink hover:bg-ink/5"
            }`}
            aria-pressed={underline}
            aria-label="Underline"
          >
            <span className="underline underline-offset-2">U</span>
          </button>
        </div>
      </div>

      {/* Text fields list */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium text-ink-soft">Text fields</p>
          <button
            type="button"
            onClick={onAddField}
            className="rounded-md border border-line px-2.5 py-1 text-xs font-medium text-ink-soft transition-colors hover:border-periwinkle hover:text-periwinkle"
          >
            + Add text
          </button>
        </div>

        <ul className="space-y-1">
          <li>
            <button
              type="button"
              onClick={() => onSelectField({ kind: "name" })}
              className={`w-full rounded-md px-3 py-2 text-left text-sm transition-colors ${
                selectedField?.kind === "name"
                  ? "bg-periwinkle/10 text-periwinkle"
                  : "text-ink hover:bg-ink/5"
              }`}
            >
              Pet name
            </button>
          </li>
          <li>
            <button
              type="button"
              onClick={() => onSelectField({ kind: "years" })}
              className={`w-full rounded-md px-3 py-2 text-left text-sm transition-colors ${
                selectedField?.kind === "years"
                  ? "bg-periwinkle/10 text-periwinkle"
                  : "text-ink hover:bg-ink/5"
              }`}
            >
              Years
            </button>
          </li>
          {extraFields.map((field) => (
            <li key={field.id} className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => onSelectField({ kind: "extra", id: field.id })}
                className={`flex-1 truncate rounded-md px-3 py-2 text-left text-sm transition-colors ${
                  selectedField?.kind === "extra" && selectedField.id === field.id
                    ? "bg-periwinkle/10 text-periwinkle"
                    : "text-ink hover:bg-ink/5"
                }`}
              >
                {field.text}
              </button>
              <button
                type="button"
                onClick={() => onRemoveField(field.id)}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded text-ink-faint transition-colors hover:bg-pink/10 hover:text-pink"
                title="Remove field"
                aria-label={`Remove "${field.text}"`}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      </div>
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

/* ─────────────────── Draggable / editable label ─────────────────── */

function DraggableLabel({
  label,
  pos,
  editing = false,
  isSelected = false,
  onSelect,
  onStartEdit,
  onEndEdit,
  onDrag,
  onNudge,
  className = "",
  style,
}: {
  label: string;
  pos: CoverPosition;
  editing?: boolean;
  isSelected?: boolean;
  onSelect?: (e: React.MouseEvent) => void;
  onStartEdit?: () => void;
  onEndEdit?: (text: string) => void;
  onDrag: (clientX: number, clientY: number) => void;
  onNudge: (dx: number, dy: number) => void;
  className?: string;
  style?: CSSProperties;
}) {
  const dragging = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (editing) return;
    event.preventDefault();
    dragging.current = true;
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragging.current) return;
    onDrag(event.clientX, event.clientY);
  };

  const handlePointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    dragging.current = false;
    event.currentTarget.releasePointerCapture(event.pointerId);
  };

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (editing) return;
    const step = event.shiftKey ? 5 : 1;
    if (event.key === "ArrowLeft") onNudge(-step, 0);
    else if (event.key === "ArrowRight") onNudge(step, 0);
    else if (event.key === "ArrowUp") onNudge(0, -step);
    else if (event.key === "ArrowDown") onNudge(0, step);
    else if (event.key === "Enter" && onStartEdit) {
      event.preventDefault();
      onStartEdit();
      requestAnimationFrame(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      });
    } else return;
    event.preventDefault();
  };

  const handleDoubleClick = () => {
    if (onStartEdit) {
      onStartEdit();
      requestAnimationFrame(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      });
    }
  };

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={
        editing
          ? `Editing "${label}"`
          : `Click to select, double-click to edit "${label}"`
      }
      onClick={onSelect}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onKeyDown={handleKeyDown}
      onDoubleClick={handleDoubleClick}
      className={`absolute z-10 max-w-[82%] whitespace-normal text-center leading-[1.05] outline-none ${
        editing ? "cursor-text" : "cursor-grab active:cursor-grabbing"
      } ${
        isSelected && !editing
          ? "ring-2 ring-white/70 ring-offset-1 ring-offset-transparent rounded-sm"
          : ""
      } focus-visible:ring-2 focus-visible:ring-white/80 ${className}`}
      style={{
        left: `${pos.x}%`,
        top: `${pos.y}%`,
        transform: "translate(-50%, -50%)",
        ...style,
      }}
    >
      {editing ? (
        <input
          ref={inputRef}
          type="text"
          defaultValue={label}
          className="w-full min-w-[6ch] bg-transparent text-center outline-none"
          style={{ font: "inherit", color: "inherit", textDecoration: "inherit" }}
          onBlur={(e) => onEndEdit?.(e.currentTarget.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              onEndEdit?.(e.currentTarget.value);
            }
            if (e.key === "Escape") {
              e.preventDefault();
              onEndEdit?.(label);
            }
            e.stopPropagation();
          }}
        />
      ) : (
        label
      )}
    </div>
  );
}

function lifespanText(meta: BookMeta): string {
  if (meta.birthYear && meta.deathYear) {
    return `${meta.birthYear} – ${meta.deathYear}`;
  }
  return meta.birthYear || meta.deathYear || "";
}
