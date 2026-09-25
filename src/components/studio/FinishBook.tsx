"use client";

import { ArrowLeft, ArrowRight, Download, Loader2 } from "lucide-react";
import { useEffect, useMemo } from "react";

import { BuyDigitalButton } from "@/components/BuyDigitalButton";
import { VideoMemoriesPanel } from "@/components/VideoMemoriesPanel";
import { track } from "@/lib/analytics";
import { orderSummary } from "@/lib/order/summary";
import { DIGITAL_PRICE, formatUsd } from "@/lib/pricing";
import { placedMemoriesReadyForCheckout } from "@/lib/video-memory/checkout-ready";
import { useOurTailTalesStore } from "@/store/useOurTailTalesStore";

/**
 * What happens after the book is finished.
 *
 * The editor used to end in mid-air: the book could be made, and then there
 * was nothing to do with it. Everything needed to sell it already existed —
 * the order is prepared by `prepareOrder`, priced by `pricing`, paid for at
 * `/checkout` and then tracked at `/order/[id]`, and the Video Memories pack
 * has its own panel — with nothing anywhere leading to any of it. This is the
 * step that leads to it.
 *
 * The order it puts things in is the order the decisions have to be made in.
 * Video Memories come first, because their codes are printed on the pages: a
 * book already at the printer cannot have one added. The hardcover follows,
 * priced to the cent from the same functions the order row is written from.
 * The PDF comes last, for somebody who wants the book but not the parcel.
 */
export function FinishBook({
  onBack,
  onCheckout,
  onDownload,
  downloading,
}: {
  onBack: () => void;
  onCheckout: () => void;
  onDownload: () => void;
  downloading: boolean;
}) {
  const meta = useOurTailTalesStore((state) => state.meta);
  const pages = useOurTailTalesStore((state) => state.pages);
  const chapterCount = useOurTailTalesStore((state) => state.chapterCount);
  const placements = useOurTailTalesStore((state) => state.placements);
  const videoAssets = useOurTailTalesStore((state) => state.videoAssets);
  const draftId = useOurTailTalesStore((state) => state.draftId);
  const draftSecret = useOurTailTalesStore((state) => state.draftSecret);
  const funnelState = useOurTailTalesStore((state) => state.funnelState);
  const exportMessage = useOurTailTalesStore((state) => state.exportMessage);

  const summary = useMemo(
    () =>
      orderSummary({
        chapterCount,
        pageCount: pages.length,
        placements,
      }),
    [chapterCount, pages.length, placements],
  );

  const petName = meta.petName.trim();
  const preparing = funnelState === "exporting";

  // A code printed in the book has to point at a video that is ready to be
  // archived, so `prepareOrder` refuses until every placed one is. Said here,
  // in front of the button, rather than left to come back as an error after
  // somebody has pressed it. Videos nobody placed can keep processing.
  const memoriesReady = placedMemoriesReadyForCheckout(placements, videoAssets);

  // The one place the pack is ever offered, so whether it is seen at all is
  // the number that says whether the offer works.
  useEffect(() => {
    track("video_memories_offer_viewed", { placed: placements.length });
    // Once per visit to this step, not once per video placed on it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
      <header>
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-page-ink-soft transition-colors hover:text-periwinkle-deep"
        >
          <ArrowLeft aria-hidden className="size-4" />
          Keep editing
        </button>

        <h1 className="mt-4 font-display text-3xl text-page-ink sm:text-4xl">
          {petName ? `${petName}’s book is ready` : "Your book is ready"}
        </h1>
        <p className="mt-2 text-sm leading-6 text-page-ink-soft">
          {summary.chapterCount}{" "}
          {summary.chapterCount === 1 ? "chapter" : "chapters"} over{" "}
          {summary.interiorPages} printed pages, hardcover bound. Nothing here is
          final until you pay, and you can go back and change any page.
        </p>
      </header>

      {/* Before the order, not after it: a Video Memory is a QR code printed
          on a page, so a book already at the printer cannot be given one. */}
      <section>
        <h2 className="sr-only">Add Video Memories</h2>
        <VideoMemoriesPanel pages={pages} />
      </section>

      <section className="rounded-2xl border border-line bg-white p-5 shadow-lift sm:p-6">
        <h2 className="font-display text-xl text-ink">The printed book</h2>
        <dl className="mt-4 flex flex-col gap-2 text-sm">
          <Row
            label={`Hardcover · ${summary.chapterCount} ${
              summary.chapterCount === 1 ? "chapter" : "chapters"
            }`}
            value={formatUsd(summary.bookPrice)}
          />
          {summary.videoMemoryPackCount > 0 ? (
            <Row
              label={`Video Memories × ${summary.videoMemoryPackCount} ${
                summary.videoMemoryPackCount === 1 ? "pack" : "packs"
              } · ${summary.videoMemoryCount} ${
                summary.videoMemoryCount === 1 ? "video" : "videos"
              }`}
              value={formatUsd(summary.videoMemoryPrice)}
            />
          ) : null}
          <Row label="Shipping" value="Quoted at checkout" muted />
          <div className="mt-1 border-t border-page-line pt-3">
            <Row
              label="Total before shipping"
              value={formatUsd(summary.subtotal)}
              strong
            />
          </div>
        </dl>

        <button
          type="button"
          onClick={onCheckout}
          disabled={preparing || !memoriesReady}
          className="mt-5 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-periwinkle px-6 text-base font-semibold text-white shadow-lift transition-colors hover:enabled:bg-periwinkle-deep disabled:cursor-not-allowed disabled:opacity-60"
        >
          {preparing ? (
            <>
              <Loader2 aria-hidden className="size-4 animate-spin" />
              Preparing your book…
            </>
          ) : (
            <>
              Continue to checkout
              <ArrowRight aria-hidden className="size-4" />
            </>
          )}
        </button>

        <p role="status" className="mt-3 text-xs leading-5 text-page-ink-faint">
          {preparing
            ? // The print-resolution render and upload take a while, and a
              // button that has gone quiet with no word of what it is doing
              // reads as a button that did not work.
              (exportMessage ??
                "Rendering your book at print resolution. This can take a minute.")
            : !memoriesReady
              ? "One of the videos you placed is still being prepared. The code has to point at a finished video, so checkout opens as soon as it is."
              : "Address and shipping come next. Payment is the last step, and nothing is sent to the printer before it."}
        </p>
      </section>

      <section className="rounded-2xl border border-line bg-white p-5 shadow-lift sm:p-6">
        <h2 className="font-display text-xl text-ink">Or keep it as a file</h2>
        <p className="mt-1 text-sm leading-6 text-ink-soft">
          The free copy carries a small watermark across each page. The clean
          one does not, and is yours to print or share however you like.
        </p>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={onDownload}
            disabled={downloading}
            className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-page-line bg-white px-5 py-3 text-sm font-semibold text-page-ink transition-colors hover:border-periwinkle hover:text-periwinkle-deep disabled:opacity-60"
          >
            <Download aria-hidden className="size-4" />
            {downloading ? "Preparing…" : "Download the free copy"}
          </button>
          {draftId && draftSecret ? (
            <BuyDigitalButton
              draftId={draftId}
              secret={draftSecret}
              price={DIGITAL_PRICE}
              label={`${formatUsd(DIGITAL_PRICE)} · the clean PDF`}
              className="flex-1"
            />
          ) : null}
        </div>
      </section>
    </div>
  );
}

function Row({
  label,
  value,
  strong = false,
  muted = false,
}: {
  label: string;
  value: string;
  strong?: boolean;
  muted?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className={strong ? "font-semibold text-ink" : "text-ink-soft"}>
        {label}
      </dt>
      <dd
        className={
          strong
            ? "font-display text-lg text-ink"
            : muted
              ? "text-ink-faint"
              : "text-ink"
        }
      >
        {value}
      </dd>
    </div>
  );
}
