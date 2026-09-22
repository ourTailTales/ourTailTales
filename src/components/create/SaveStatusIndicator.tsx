"use client";

import { Check, Loader2 } from "lucide-react";

import { useOurTailTalesStore } from "@/store/useOurTailTalesStore";

/**
 * Small pill next to the logo showing whether the current draft is saved to
 * this browser. Idle/checkmark most of the time; flips to an active spinner
 * for the moment an edit is being written to the local draft.
 */
export function SaveStatusIndicator() {
  const saving = useOurTailTalesStore((state) => state.saveStatus === "saving");

  return (
    <span
      role="status"
      aria-live="polite"
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
        saving
          ? "border-periwinkle/40 bg-periwinkle/10 text-periwinkle-deep"
          : "border-page-line bg-white text-page-ink-faint"
      }`}
    >
      {saving ? (
        <Loader2 aria-hidden className="size-3.5 animate-spin" />
      ) : (
        <Check aria-hidden className="size-3.5" />
      )}
      {saving ? "Saving…" : "Saved"}
    </span>
  );
}
