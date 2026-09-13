import { formatUsd } from "@/lib/pricing";
import { centsToUsd, videoMemoryQuote } from "@/lib/video-memory/pricing";

export type PackMeterView =
  | { kind: "empty" }
  | {
      kind: "active";
      used: number;
      capacity: number;
      priceCents: number;
      usedLabel: string;
      priceLabel: string;
    };

export function packMeterView(includedUniqueCount: number): PackMeterView {
  const quote = videoMemoryQuote(includedUniqueCount);
  if (quote.packCount === 0) return { kind: "empty" };
  return {
    kind: "active",
    used: quote.includedUniqueVideoCount,
    capacity: quote.packCapacity,
    priceCents: quote.totalCents,
    usedLabel: `${quote.includedUniqueVideoCount} of ${quote.packCapacity} used`,
    priceLabel: formatUsd(centsToUsd(quote.totalCents)),
  };
}

export const ZERO_STATE_HEADING = "Video Memories";
export const ZERO_STATE_OFFER = "Add up to 10 Video Memories for $19.99";
export const ZERO_STATE_BODY =
  "Include videos you can watch from your printed book.";

export function packBoundaryCopy(currentCapacity: number): {
  title: string;
  body: string;
  confirm: string;
} {
  const nextCapacity = currentCapacity + 10;
  return {
    title: "Add another Video Memories pack?",
    body: `You’ve used all ${currentCapacity} Video Memories in your current pack. Add 10 more Video Memories for $19.99. You’ll have room for up to ${nextCapacity} Video Memories.`,
    confirm: "Add 10 More — $19.99",
  };
}
