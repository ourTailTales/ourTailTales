"use client";

import { useState } from "react";

import { postHogHeaders } from "@/lib/posthog-client";
import { formatUsd } from "@/lib/pricing";

/**
 * Buying the clean, unwatermarked PDF of a banked book.
 *
 * The route answers some requests with an instruction rather than a failure —
 * "make your free account first", "this book has expired" — because until the
 * whole book is banked the only file behind the draft is the ten-page teaser,
 * and selling someone a complete book that turns out to be the sample they
 * already had is the worst thing this product could do. Those answers are
 * shown as written.
 *
 * Shared by the shared-link page and by the finishing step in the editor, so
 * there is one place that knows what the route expects and what it may say.
 */
export function BuyDigitalButton({
  draftId,
  secret,
  price,
  label,
  className = "",
}: {
  draftId: string;
  secret: string;
  price: number;
  /** Overrides the default wording, which leads with the price. */
  label?: string;
  className?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const buy = async (): Promise<void> => {
    setBusy(true);
    setNotice(null);
    try {
      const response = await fetch("/api/stripe/checkout-digital", {
        method: "POST",
        headers: {
          ...postHogHeaders(),
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
    <div className={className}>
      <button
        type="button"
        onClick={() => void buy()}
        disabled={busy}
        className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-page-line bg-white px-5 py-3 text-sm font-semibold text-page-ink transition-colors hover:border-periwinkle hover:text-periwinkle-deep disabled:opacity-60"
      >
        {busy
          ? "Opening checkout…"
          : (label ?? `${formatUsd(price)} · keep the full PDF`)}
      </button>
      {notice ? (
        <p role="status" className="mt-3 text-sm text-periwinkle-deep">
          {notice}
        </p>
      ) : null}
    </div>
  );
}
