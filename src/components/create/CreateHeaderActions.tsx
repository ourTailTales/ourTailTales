"use client";

import { Download } from "lucide-react";

import { useOurTailTalesStore } from "@/store/useOurTailTalesStore";

/**
 * Right-hand content of the site header on /create: the email already
 * captured on the landing page (no re-asking, no account) and a one-click
 * PDF download that renders straight from the current draft — no sign-in
 * required. Meant to sit inline with the logo via SiteHeader's `right` slot.
 */
export function CreateHeaderActions({
  onDownloadPdf,
  downloading = false,
}: {
  onDownloadPdf: () => void;
  downloading?: boolean;
}) {
  const leadEmail = useOurTailTalesStore((state) => state.leadEmail);
  const hasPages = useOurTailTalesStore((state) => state.pages.length > 0);
  const funnelState = useOurTailTalesStore((state) => state.funnelState);
  // Pages exist as soon as the book size is confirmed, well before the
  // chapters actually have written story text — so gate on story generation
  // having finished ("editing"/"exporting"), not just on pages existing.
  const storyReady =
    hasPages && (funnelState === "editing" || funnelState === "exporting");
  const canDownload = storyReady && !downloading;

  return (
    <div className="flex min-w-0 items-center gap-3 sm:gap-4">
      <p className="hidden min-w-0 max-w-[9rem] truncate text-sm font-medium text-page-ink-soft sm:block sm:max-w-[16rem]">
        {leadEmail ?? "Your story, saved in this browser"}
      </p>
      <button
        type="button"
        onClick={onDownloadPdf}
        disabled={!canDownload}
        title={storyReady ? undefined : "Finish creating their story to download a PDF"}
        className="inline-flex min-h-10 shrink-0 items-center gap-2 rounded-xl border border-page-line bg-white px-4 py-2 text-sm font-semibold text-page-ink shadow-sm transition-colors hover:border-periwinkle hover:text-periwinkle-deep disabled:cursor-not-allowed disabled:opacity-40"
      >
        <Download aria-hidden className="size-4" />
        {downloading ? "Preparing…" : "Download PDF"}
      </button>
    </div>
  );
}
