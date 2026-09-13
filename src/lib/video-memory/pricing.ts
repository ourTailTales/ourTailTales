import {
  VIDEO_MEMORIES_PER_PACK,
  VIDEO_MEMORY_PACK_PRICE_CENTS,
} from "@/lib/video-memory/config";

export type VideoMemoryQuote = {
  includedUniqueVideoCount: number;
  packCount: number;
  packCapacity: number;
  unitPriceCents: number;
  totalCents: number;
};

/**
 * Packs are derived from unique videos that have at least one active placement.
 * Uploads and extra QR placements do not change this count.
 */
export function videoMemoryQuote(
  includedUniqueVideoCount: number,
): VideoMemoryQuote {
  const count = Math.max(0, Math.floor(includedUniqueVideoCount));
  const packCount =
    count === 0 ? 0 : Math.ceil(count / VIDEO_MEMORIES_PER_PACK);
  return {
    includedUniqueVideoCount: count,
    packCount,
    packCapacity: packCount * VIDEO_MEMORIES_PER_PACK,
    unitPriceCents: VIDEO_MEMORY_PACK_PRICE_CENTS,
    totalCents: packCount * VIDEO_MEMORY_PACK_PRICE_CENTS,
  };
}

export function centsToUsd(cents: number): number {
  return Math.round(cents) / 100;
}

export function wouldOpenNewPack(
  currentIncludedCount: number,
  addingNewUnique: boolean,
): boolean {
  if (!addingNewUnique) return false;
  const next = currentIncludedCount + 1;
  return (
    videoMemoryQuote(next).packCount > videoMemoryQuote(currentIncludedCount).packCount
  );
}
