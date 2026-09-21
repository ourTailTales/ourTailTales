"use client";

import { useMemo } from "react";

import { possessivePetName } from "@/lib/book/pagination";
import { bookSpec, formatUsd } from "@/lib/pricing";
import { useOurTailTalesStore } from "@/store/useOurTailTalesStore";

export function FinishStep({
  onSample,
  onCheckout,
  notice,
}: {
  onSample: () => void;
  onCheckout: () => void;
  notice?: string | null;
}) {
  const meta = useOurTailTalesStore((state) => state.meta);
  const chapterCount = useOurTailTalesStore((state) => state.chapterCount);
  const exportMessage = useOurTailTalesStore((state) => state.exportMessage);
  const funnelState = useOurTailTalesStore((state) => state.funnelState);
  const spec = useMemo(() => bookSpec(chapterCount), [chapterCount]);

  return (
    <div className="flex max-w-lg flex-col gap-5">
      <div>
        <h2 className="font-display text-2xl text-page-ink sm:text-3xl">
          Keep {possessivePetName(meta.petName || "your pet")} story
        </h2>
        <p className="mt-2 text-sm leading-6 text-page-ink-soft">
          Email a sample PDF or order the printed book
          — {chapterCount} chapters · {formatUsd(spec.price)}.
        </p>
      </div>

      {funnelState === "exporting" && (
        <p
          role="status"
          className="rounded-xl border border-periwinkle/30 bg-periwinkle-wash/40 px-4 py-3 text-sm text-periwinkle-deep"
        >
          {exportMessage ?? "Preparing your book…"}
        </p>
      )}

      {notice ? (
        <p role="alert" className="text-sm text-periwinkle-deep">
          {notice}
        </p>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <button
          type="button"
          onClick={onSample}
          className="rounded-xl border border-page-line bg-white/80 px-4 py-2.5 text-sm font-medium text-page-ink-soft transition-colors hover:border-periwinkle hover:text-periwinkle-deep"
        >
          Email me a sample
        </button>
        <button
          type="button"
          onClick={onCheckout}
          className="rounded-xl bg-periwinkle px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-periwinkle-deep"
        >
          Order hardcover · {formatUsd(spec.price)}
        </button>
      </div>
    </div>
  );
}
