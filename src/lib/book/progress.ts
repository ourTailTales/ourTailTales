import { MIN_PHOTOS_FOR_BOOK } from "@/lib/pricing";
import type { FunnelState } from "@/store/useOurTailTalesStore";

/**
 * What the book needs next, decided from its condition rather than from the
 * step it last completed.
 *
 * The distinction matters because the recorded step lies. A draft saved
 * halfway through generation comes back marked `album_ready` with all its
 * chapters already built, and a rule written as "album_ready means build the
 * chapters" does nothing with it — the book sits on a spinner forever with
 * everything it needs already in hand. Asking what is actually true of the
 * book instead ("are there chapters? are they written?") means every
 * recoverable state recovers by itself.
 */

export type BookStep =
  /** Something else is already working: photos being read, chapters being written. */
  | "wait"
  /** Enough photos have arrived — group them into chapters. */
  | "build"
  /** Chapters exist with nothing written in them. */
  | "write"
  /** Every chapter is written. Open the book. */
  | "open"
  /** Some photos, but not enough to fill a book. Ask for more. */
  | "needPhotos";

export function nextBookStep(book: {
  funnelState: FunnelState;
  /** Chapters that exist, written or not. */
  chapterCount: number;
  /** Of those, how many still have no story. */
  unwritten: number;
  /** Usable photos plus videos. */
  mediaCount: number;
}): BookStep {
  const { funnelState, chapterCount, unwritten, mediaCount } = book;

  // Work already in flight, or a book already open. Nothing to decide.
  if (
    funnelState === "processing" ||
    funnelState === "ai_generating" ||
    funnelState === "editing" ||
    funnelState === "exporting" ||
    funnelState === "idle"
  ) {
    return "wait";
  }

  if (chapterCount === 0) {
    return mediaCount >= MIN_PHOTOS_FOR_BOOK ? "build" : "needPhotos";
  }

  return unwritten === 0 ? "open" : "write";
}
