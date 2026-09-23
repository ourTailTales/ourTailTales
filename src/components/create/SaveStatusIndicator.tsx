"use client";

import { AlertTriangle, Check, Loader2 } from "lucide-react";

import { useOurTailTalesStore } from "@/store/useOurTailTalesStore";

/**
 * Small pill next to the logo showing whether the current draft is saved to
 * this browser.
 *
 * The failure state is the reason this exists. A browser can refuse to store
 * a hundred-photo album and a whole book, and when it does the customer has
 * to be told, because the next thing they do is close the tab.
 */
export function SaveStatusIndicator() {
  const status = useOurTailTalesStore((state) => state.saveStatus);

  const tone =
    status === "error"
      ? "border-red-300 bg-red-50 text-red-700"
      : status === "saving"
        ? "border-periwinkle/40 bg-periwinkle/10 text-periwinkle-deep"
        : "border-page-line bg-white text-page-ink-faint";

  return (
    <span
      role="status"
      aria-live="polite"
      title={
        status === "error"
          ? "This browser would not store your book. Ordering still works, but closing this tab may lose your edits."
          : undefined
      }
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${tone}`}
    >
      {status === "error" ? (
        <AlertTriangle aria-hidden className="size-3.5" />
      ) : status === "saving" ? (
        <Loader2 aria-hidden className="size-3.5 animate-spin" />
      ) : (
        <Check aria-hidden className="size-3.5" />
      )}
      {status === "error" ? "Not saved" : status === "saving" ? "Saving…" : "Saved"}
    </span>
  );
}
