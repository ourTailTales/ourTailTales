"use client";

import { useState } from "react";
import { ArrowRight, BookOpen } from "lucide-react";

import { formatUsd } from "@/lib/pricing";

/**
 * The two ways to pay, shown under the free account offer rather than instead
 * of it.
 *
 * Buying the clean PDF needs the whole book banked, which happens when the
 * account is made — so the checkout route may answer with "make your account
 * first". That answer is surfaced as written rather than flattened into a
 * generic failure, because it is an instruction, not an error.
 */
export function UpgradeActions({
  draftId,
  secret,
  digitalPrice,
  hardcoverPrice,
}: {
  draftId: string;
  secret: string;
  digitalPrice: number;
  hardcoverPrice: number;
}) {
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const buyDigital = async (): Promise<void> => {
    setBusy(true);
    setNotice(null);
    try {
      const response = await fetch("/api/stripe/checkout-digital", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-draft-id": draftId,
          authorization: `Bearer ${secret}`,
        },
        body: JSON.stringify({ draftId }),
      });
      const data = (await response.json().catch(() => ({}))) as {
        url?: string;
        error?: string;
      };
      if (response.ok && data.url) {
        window.location.href = data.url;
        return;
      }
      setNotice(data.error ?? "Checkout is not available just yet.");
    } catch {
      setNotice("Checkout could not be reached. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row">
        <button
          type="button"
          onClick={() => void buyDigital()}
          disabled={busy}
          className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-page-line bg-white px-5 py-3 text-sm font-semibold text-page-ink transition-colors hover:border-periwinkle hover:text-periwinkle-deep disabled:opacity-60"
        >
          {busy ? "Opening checkout…" : `${formatUsd(digitalPrice)} — keep the full PDF`}
        </button>
        <a
          href="/create"
          className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-page-line bg-white px-5 py-3 text-sm font-semibold text-page-ink transition-colors hover:border-periwinkle hover:text-periwinkle-deep"
        >
          <BookOpen aria-hidden className="size-4" />
          Order the hardcover from {formatUsd(hardcoverPrice)}
          <ArrowRight aria-hidden className="size-4" />
        </a>
      </div>
      {notice && (
        <p role="status" className="mt-3 text-sm text-periwinkle-deep">
          {notice}
        </p>
      )}
    </div>
  );
}
