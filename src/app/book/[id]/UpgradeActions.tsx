"use client";

import { ArrowRight, BookOpen } from "lucide-react";

import { BuyDigitalButton } from "@/components/BuyDigitalButton";
import { formatUsd } from "@/lib/pricing";

/**
 * The two ways to pay, shown under the free account offer rather than instead
 * of it.
 *
 * The PDF button is `BuyDigitalButton`, shared with the finishing step in the
 * editor: what the checkout route expects, and the instructions it answers
 * with, are known in one place.
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
  return (
    <div className="flex flex-col gap-3 sm:flex-row">
      <BuyDigitalButton
        draftId={draftId}
        secret={secret}
        price={digitalPrice}
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
