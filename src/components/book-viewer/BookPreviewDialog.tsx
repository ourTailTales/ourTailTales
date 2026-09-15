"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useMediaQuery } from "@/components/hero/useHeroMedia";
import {
  currentPageForFocus,
  focusFromCurrentPage,
  lastReadablePage,
  nearbyInteriorIndexes,
  previewSpreadLabel,
} from "@/lib/book/preview-model";
import {
  photoMapOf,
  useOurTailTalesStore,
} from "@/store/useOurTailTalesStore";

import { BookViewer } from "./BookViewer";
import { nearbyPreviewImageUrls, buildCustomerBookSheets } from "./previewSheets";

const FOCUSABLE =
  'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

export function BookPreviewDialog({ onClose }: { onClose: () => void }) {
  const pages = useOurTailTalesStore((state) => state.pages);
  const chapters = useOurTailTalesStore((state) => state.chapters);
  const meta = useOurTailTalesStore((state) => state.meta);
  const photos = useOurTailTalesStore((state) => state.photos);
  const photoMap = useMemo(() => photoMapOf(photos), [photos]);
  const narrow = useMediaQuery("(max-width: 719px)");
  const pairing = narrow ? "single" : "spread";

  const [coverOpen, setCoverOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);
  const [closed, setClosed] = useState(true);
  const [focusPage, setFocusPage] = useState(0);
  const panelRef = useRef<HTMLDivElement>(null);
  const restoreRef = useRef<HTMLElement | null>(null);

  const sheets = useMemo(
    () =>
      buildCustomerBookSheets({
        pages,
        chapters,
        meta,
        photos: photoMap,
        pairing,
      }),
    [pages, chapters, meta, photoMap, pairing],
  );

  const initialPage = coverOpen
    ? currentPageForFocus(focusPage, pairing)
    : 0;
  const maxPage = lastReadablePage(sheets.length * 2);
  const label = previewSpreadLabel({
    currentPage,
    interiorCount: pages.length,
    pairing,
    closed,
  });

  const handlePageChange = useCallback(
    (page: number, isClosed: boolean) => {
      setCurrentPage(page);
      setClosed(isClosed);
      setFocusPage(focusFromCurrentPage(page, pairing, isClosed));
    },
    [pairing],
  );

  useEffect(() => {
    restoreRef.current = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panelRef.current?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
      restoreRef.current?.focus?.();
    };
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab") return;
      const root = panelRef.current;
      if (!root) return;
      const nodes = [...root.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
        (node) => !node.hasAttribute("disabled") && node.tabIndex !== -1,
      );
      if (nodes.length === 0) return;
      const first = nodes[0]!;
      const last = nodes[nodes.length - 1]!;
      const active = document.activeElement;
      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    const coverId = meta.coverPhotoId ?? chapters[0]?.heroPhotoId ?? null;
    const coverUrl = coverId ? photoMap.get(coverId)?.thumbUrl : null;
    const urls = nearbyPreviewImageUrls({
      pages,
      photos: photoMap,
      indexes: nearbyInteriorIndexes(currentPage, pages.length, pairing),
    });
    if (coverUrl) urls.unshift(coverUrl);

    const images = urls.map((src) => {
      const image = new Image();
      image.src = src;
      return image;
    });
    return () => {
      for (const image of images) {
        image.onload = null;
        image.onerror = null;
        image.src = "";
      }
    };
  }, [chapters, currentPage, meta.coverPhotoId, pages, pairing, photoMap]);

  return (
    <div
      className="bv-preview-dialog"
      role="dialog"
      aria-modal="true"
      aria-labelledby="bookPreviewTitle"
    >
      <button
        type="button"
        className="bv-preview-dialog__backdrop"
        aria-label="Close book preview"
        onClick={onClose}
      />

      <div ref={panelRef} className="bv-preview-dialog__panel" tabIndex={-1}>
        <header className="bv-preview-dialog__header">
          <div>
            <h2 id="bookPreviewTitle" className="bv-preview-dialog__title">
              Preview your book
            </h2>
            <p className="bv-preview-dialog__hint">
              {narrow
                ? "Swipe or tap the page to turn. Esc closes."
                : "Click a page or drag a corner to turn. Esc closes."}
            </p>
          </div>
          <button
            type="button"
            className="bv-preview-dialog__close"
            onClick={onClose}
          >
            Close
          </button>
        </header>

        <div className="bv-preview-dialog__stage">
          <BookViewer
            key={pairing}
            sheets={sheets}
            coverOpen={coverOpen}
            initialPage={initialPage}
            maxPage={maxPage}
            preferSingleFirstLeaf={pairing === "single"}
            keyboard="local"
            fit="preview"
            clickToTurn
            allowCoverClose
            hideNav={false}
            spreadLabel={label}
            onPageChange={handlePageChange}
            onRequestOpen={() => setCoverOpen(true)}
            onRequestClose={() => setCoverOpen(false)}
          />
        </div>
      </div>
    </div>
  );
}
