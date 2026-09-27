"use client";

import { useState } from "react";

import { AuthGate } from "@/components/auth/AuthGate";
import { captureClientException } from "@/lib/analytics";
import { renderAndBankFullBook } from "@/lib/drafts/claim";
import { postHogHeaders } from "@/lib/posthog-client";
import { formatUsd } from "@/lib/pricing";
import { useIsAuthenticated } from "@/hooks/useIsAuthenticated";
import { useOurTailTalesStore } from "@/store/useOurTailTalesStore";

/**
 * Buying the clean PDF, without a dead end at "make your free account
 * first".
 *
 * That instruction is not filler copy: `checkout-digital` really has nothing
 * to sell until the whole book is rendered and banked, which only happens
 * once, in the browser that holds the actual photos. On the finishing step in
 * the editor that browser is always this one. On the emailed link it usually
 * is too — but either way, the old door this pointed at was a whole separate
 * page that lost the purchase in progress, needless friction for the case
 * that matters most: the same visitor, same tab, wanting to pay right now.
 *
 * So a click here first asks this browser whether it still has that book's
 * pages at all. If it does, the account (or an existing session) is all
 * that is missing, and this gets it inline — sign up, bank the clean file,
 * finish the checkout it already had underway. If it does not — the emailed
 * link opened on a different device than the one that made the book — there
 * truly is nothing to render from, and no form here changes that; the
 * message says so plainly instead of guessing.
 */
export function ClaimAndBuyDigital({
  draftId,
  secret,
  price,
  knownEmail,
  label,
  className = "",
}: {
  draftId: string;
  secret: string;
  price: number;
  knownEmail: string | null;
  /** Overrides the default wording, which leads with the price. */
  label?: string;
  className?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [claimableHere, setClaimableHere] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const isAuthenticated = useIsAuthenticated();

  const checkout = async (): Promise<{ ok: boolean; error?: string }> => {
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
      return { ok: true };
    }
    return { ok: false, error: data.error };
  };

  /** Whether this browser's local copy is the same book this link points at. */
  const bookIsLocallyAvailable = (): boolean => {
    const state = useOurTailTalesStore.getState();
    return state.draftId === draftId && state.pages.length > 0;
  };

  const finishClaimAndBuy = async (): Promise<void> => {
    setBusy(true);
    setNotice(null);
    try {
      await renderAndBankFullBook();
      const result = await checkout();
      if (!result.ok) {
        setNotice(result.error ?? "Checkout is not available just yet.");
      }
    } catch (error) {
      captureClientException(error);
      setNotice("Your book could not be prepared. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const buy = async (): Promise<void> => {
    setBusy(true);
    setNotice(null);
    try {
      const result = await checkout();
      if (result.ok) return;

      const needsAccount = /make your free account first/i.test(result.error ?? "");
      if (!needsAccount) {
        setNotice(result.error ?? "Checkout is not available just yet.");
        return;
      }

      // Only restore from local storage when the live store does not already
      // have this book — on the editor's own finishing screen it always
      // does. Restoring unconditionally would overwrite whatever is live in
      // memory with the last *persisted* snapshot, which is exactly how a
      // click here could silently roll back edits made since the last
      // autosave, right before rendering the file that gets sold.
      if (!bookIsLocallyAvailable()) {
        await useOurTailTalesStore.getState().restoreLocalBook(knownEmail);
      }

      if (!bookIsLocallyAvailable()) {
        setClaimableHere(false);
        setNotice(
          "This book's photos are only saved on the device where you made it. Open this same link there — creating your free account is what unlocks the clean PDF, on that device.",
        );
        return;
      }

      setClaimableHere(true);
      if (isAuthenticated) {
        await finishClaimAndBuy();
      } else {
        setAuthOpen(true);
      }
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
        {busy ? "Opening checkout…" : (label ?? `${formatUsd(price)} · keep the full PDF`)}
      </button>
      {notice ? (
        <p role="status" className="mt-3 text-sm text-periwinkle-deep">
          {notice}
        </p>
      ) : null}

      {authOpen && claimableHere && (
        <AuthGate
          initialEmail={knownEmail}
          onClose={() => setAuthOpen(false)}
          onAuthenticated={() => {
            setAuthOpen(false);
            void finishClaimAndBuy();
          }}
        />
      )}
    </div>
  );
}
