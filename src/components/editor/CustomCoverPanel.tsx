"use client";

import { useEffect, useState } from "react";
import { FileText, UploadCloud, X } from "lucide-react";

import type { CoverDimensionsPt } from "@/lib/book/cover-pdf";
import { validateCustomCoverFile } from "@/lib/book/customCover";
import {
  clearCustomCoverFile,
  getCustomCoverFile,
  getCustomCoverUrl,
  setCustomCoverFile,
} from "@/lib/book/customCoverStore";
import { luluInteriorPages } from "@/lib/pricing";
import { useOurTailTalesStore } from "@/store/useOurTailTalesStore";

const TARGET_PPI = 300;

/**
 * Lets the customer upload their own print-ready front+spine+back cover
 * (PNG/JPG/JPEG or a single combined PDF, per Lulu's one-file wrap) instead
 * of using the in-app cover design. Sizing is fetched live from Lulu for the
 * book's current chapter count and checked strictly — no auto-scaling — so
 * a mismatch is caught here instead of at print time.
 */
export function CustomCoverPanel() {
  const chapterCount = useOurTailTalesStore((state) => state.chapterCount);
  const customCover = useOurTailTalesStore((state) => state.customCover);
  const setCustomCover = useOurTailTalesStore((state) => state.setCustomCover);

  const pageCount = luluInteriorPages(chapterCount);
  // Tagged with the pageCount it was fetched for, so a chapter-count change
  // shows "Calculating…" again without a synchronous reset at effect start.
  const [dimensionsResult, setDimensionsResult] = useState<
    | { status: "ready"; pageCount: number; value: CoverDimensionsPt }
    | { status: "error"; pageCount: number; message: string }
    | null
  >(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(() => getCustomCoverUrl());

  useEffect(() => {
    let cancelled = false;
    fetch("/api/lulu/cover-dimensions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pageCount }),
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("dimensions request failed");
        return (await response.json()) as CoverDimensionsPt;
      })
      .then((data) => {
        if (!cancelled) setDimensionsResult({ status: "ready", pageCount, value: data });
      })
      .catch(() => {
        if (!cancelled) {
          setDimensionsResult({
            status: "error",
            pageCount,
            message: "This book's cover size could not be calculated. Try again in a moment.",
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [pageCount]);

  const dimensions =
    dimensionsResult?.status === "ready" && dimensionsResult.pageCount === pageCount
      ? dimensionsResult.value
      : null;
  const dimensionsError =
    dimensionsResult?.status === "error" && dimensionsResult.pageCount === pageCount
      ? dimensionsResult.message
      : null;

  const stale = Boolean(customCover) && customCover?.validatedForPages !== pageCount;
  const isImage = customCover?.mimeType.startsWith("image/") ?? false;

  const inches = dimensions
    ? { w: (dimensions.width / 72).toFixed(2), h: (dimensions.height / 72).toFixed(2) }
    : null;
  const pixels = dimensions
    ? {
        w: Math.round((dimensions.width / 72) * TARGET_PPI),
        h: Math.round((dimensions.height / 72) * TARGET_PPI),
      }
    : null;

  async function handleFile(file: File) {
    if (!dimensions) return;
    setBusy(true);
    setError(null);
    try {
      const result = await validateCustomCoverFile(file, dimensions, TARGET_PPI);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      const url = setCustomCoverFile(file);
      setPreviewUrl(url);
      setCustomCover({
        fileName: file.name,
        mimeType: file.type || (result.kind === "pdf" ? "application/pdf" : "image/*"),
        sizeBytes: file.size,
        validatedForPages: pageCount,
        widthPt: result.widthPt,
        heightPt: result.heightPt,
      });
    } finally {
      setBusy(false);
    }
  }

  async function handleRecheck() {
    const file = getCustomCoverFile();
    if (!file || !dimensions) return;
    setBusy(true);
    setError(null);
    try {
      const result = await validateCustomCoverFile(file, dimensions, TARGET_PPI);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setCustomCover({
        fileName: file.name,
        mimeType: file.type,
        sizeBytes: file.size,
        validatedForPages: pageCount,
        widthPt: result.widthPt,
        heightPt: result.heightPt,
      });
    } finally {
      setBusy(false);
    }
  }

  function handleRemove() {
    clearCustomCoverFile();
    setPreviewUrl(null);
    setCustomCover(null);
    setError(null);
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-page-line bg-white p-4">
        <p className="text-sm font-medium text-page-ink">Your book&rsquo;s exact cover size</p>
        {dimensions && inches && pixels ? (
          <p className="mt-1 text-sm text-page-ink-soft">
            {inches.w}&Prime; &times; {inches.h}&Prime; ({pixels.w}&times;{pixels.h}px at{" "}
            {TARGET_PPI} DPI) one flat file for front, spine, and back, no panels marked.
          </p>
        ) : dimensionsError ? (
          <p className="mt-1 text-sm text-periwinkle-deep">{dimensionsError}</p>
        ) : (
          <p className="mt-1 text-sm text-page-ink-faint">Calculating&hellip;</p>
        )}
        <p className="mt-1.5 text-xs text-page-ink-faint">
          Based on this book&rsquo;s current length ({pageCount} interior pages). If you change
          the chapter count later, this file needs a quick re-check.
        </p>
      </div>

      {customCover ? (
        <div className="flex items-center gap-3 rounded-xl border border-page-line bg-white p-3">
          {isImage && previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- local object URL
            <img
              src={previewUrl}
              alt=""
              className="h-16 w-16 shrink-0 rounded-md object-cover"
            />
          ) : (
            <FileText className="h-8 w-8 shrink-0 text-page-ink-faint" aria-hidden />
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-page-ink">{customCover.fileName}</p>
            <p className="text-xs text-page-ink-faint">
              {(customCover.sizeBytes / (1024 * 1024)).toFixed(1)} MB
              {stale ? " · sized for a different chapter count" : " · matches this book exactly"}
            </p>
          </div>
          <button
            type="button"
            onClick={handleRemove}
            className="shrink-0 rounded-full p-1.5 text-page-ink-faint transition-colors hover:bg-periwinkle/10 hover:text-periwinkle-deep"
            title="Remove custom cover"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>
      ) : null}

      {stale ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-periwinkle/30 bg-periwinkle-wash/40 px-4 py-3">
          <p className="text-sm text-page-ink-soft">
            Your chapter count changed, so this file needs to be checked against the new size.
          </p>
          <button
            type="button"
            onClick={() => void handleRecheck()}
            disabled={busy || !dimensions}
            className="shrink-0 rounded-xl bg-periwinkle px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-periwinkle-deep disabled:cursor-not-allowed disabled:opacity-50"
          >
            Check again
          </button>
        </div>
      ) : null}

      {error ? (
        <p role="alert" className="text-sm text-periwinkle-deep">
          {error}
        </p>
      ) : null}

      <label
        className={`flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-page-line bg-lavender/20 px-6 py-8 text-center transition-colors ${
          busy || !dimensions ? "cursor-not-allowed opacity-60" : "cursor-pointer hover:border-periwinkle"
        }`}
      >
        <UploadCloud className="h-6 w-6 text-page-ink-faint" aria-hidden />
        <span className="text-sm font-medium text-page-ink">
          {customCover ? "Replace file" : "Choose a PNG, JPG, or PDF"}
        </span>
        <span className="text-xs text-page-ink-faint">Must match the size above exactly</span>
        <input
          type="file"
          accept=".png,.jpg,.jpeg,.pdf,image/png,image/jpeg,application/pdf"
          className="sr-only"
          disabled={busy || !dimensions}
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (file) void handleFile(file);
          }}
        />
      </label>
      {busy ? <p className="text-xs text-page-ink-faint">Checking your file&hellip;</p> : null}
    </div>
  );
}
