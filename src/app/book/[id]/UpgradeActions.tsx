"use client";

import { ArrowRight, BookOpen } from "lucide-react";

import { ClaimAndBuyDigital } from "@/components/ClaimAndBuyDigital";
import { formatUsd } from "@/lib/pricing";

/**
 * The two ways to pay, shown under the free account offer rather than instead
 * of it.
 */
export function UpgradeActions({
  draftId,
  secret,
  digitalPrice,
  hardcoverPrice,
  knownEmail,
}: {
  draftId: string;
  secret: string;
  digitalPrice: number;
  hardcoverPrice: number;
  knownEmail: string | null;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row">
      <ClaimAndBuyDigital
        draftId={draftId}
        secret={secret}
        price={digitalPrice}
        knownEmail={knownEmail}
        className="flex-1"
      />
      <a
        href="/create"
        className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-page-line bg-white px-5 py-3 text-sm font-semibold text-page-ink transition-colors hover:border-periwinkle hover:text-periwinkle-deep"
      >
        <BookOpen aria-hidden className="size-4" />
        Order the hardcover from {formatUsd(hardcoverPrice)}
        <ArrowRight aria-hidden className="size-4" />
      </a>
    </div>
  );
}
