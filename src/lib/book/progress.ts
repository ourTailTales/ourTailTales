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
  /** Enough photos have arrived — ask how long the book should be. */
  | "size"
  /** The size is settled — group the photos into that many chapters. */
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
  /**
   * Usable photographs on their own.
   *
   * Videos count towards the album but cannot become chapters, so this is the
   * number that decides whether there is a book to build at all.
   */
  photoCount: number;
  /** True once the customer has agreed to a length, and so to a price. */
  sizeConfirmed: boolean;
}): BookStep {
  const { funnelState, chapterCount, unwritten, mediaCount, photoCount, sizeConfirmed } =
    book;

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

  // The customer is looking at what the book would be and what it would cost.
  // Nothing may start from here: the next thing after this gate is chapters
  // being written, one paid model call each, at a price they have not agreed
  // to yet.
  if (funnelState === "configure") return "wait";

  if (chapterCount === 0) {
    // Photographs, not media. Videos are part of the album and none of them
    // becomes a chapter, so counting them here was the gate letting through
    // books that could not be made: one picture and twenty-four videos
    // cleared it, and since the chapter count floors at five, that produced a
    // five-chapter book with four empty chapters, five paid writing calls and
    // a fifty dollar price on it.
    //
    // `MIN_PHOTOS_FOR_BOOK` is five chapters times the five pictures a
    // chapter needs, which is exactly the question being asked here.
    void mediaCount;
    if (photoCount < MIN_PHOTOS_FOR_BOOK) return "needPhotos";
    // Asked before built. Grouping the photographs is free, but what follows
    // it is not, and the length of the book is no longer a fixed five: it
    // comes from the album, and so does the price.
    return sizeConfirmed ? "build" : "size";
  }

  return unwritten === 0 ? "open" : "write";
}
