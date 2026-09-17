import { formatUsd } from "@/lib/pricing";
import {
  VIDEO_MEMORIES_PER_PACK,
  VIDEO_MEMORY_PACK_PRICE_CENTS,
} from "@/lib/video-memory/config";
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
export const ZERO_STATE_OFFER = `Add up to ${VIDEO_MEMORIES_PER_PACK} Video Memories for ${formatUsd(centsToUsd(VIDEO_MEMORY_PACK_PRICE_CENTS))}`;
export const ZERO_STATE_BODY =
  "Include videos you can watch from your printed book.";

export function packBoundaryCopy(currentCapacity: number): {
  title: string;
  body: string;
  confirm: string;
} {
  const nextCapacity = currentCapacity + VIDEO_MEMORIES_PER_PACK;
  const packPrice = formatUsd(centsToUsd(VIDEO_MEMORY_PACK_PRICE_CENTS));
  return {
    title: "Add another Video Memories pack?",
    body: `You’ve used all ${currentCapacity} Video Memories in your current pack. Add ${VIDEO_MEMORIES_PER_PACK} more Video Memories for ${packPrice}. You’ll have room for up to ${nextCapacity} Video Memories.`,
    confirm: `Add ${VIDEO_MEMORIES_PER_PACK} More — ${packPrice}`,
  };
}
