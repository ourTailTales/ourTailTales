import type { PlaceLabel } from "@/types/book";

/**
 * The contract between the browser and `POST /api/story`.
 *
 * Both sides import these types, so changing the AI provider can never quietly
 * change the shape the editor and the printed page depend on.
 */

/** What the browser sends for one chapter. */
export type StoryRequest = {
  petName: string;
  /** Owner-supplied: "dog", "cat", "rabbit". Never inferred from the photos. */
  species?: string;
  /** Owner-supplied. False means the book is a memorial. */
  stillHere?: boolean;
  /** One owner-supplied line about the pet. Evidence, like the photographs. */
  notes?: string;
  /** Owner-supplied years, e.g. "2017–2024". Never inferred. */
  lifespan: string;
  /** What the pet looks like and wears, from the one-off profile look. */
  profile?: Pick<PetProfile, "appearance" | "accessories" | "motifs">;
  dateLabel: string;
  /** 1-based position of this period in the book, and how many there are. */
  chapterNumber?: number;
  chapterCount?: number;
  photoCount: number;
  selectedCount: number;
  /** Coarse city/region/country clusters only. */
  places: PlaceLabel[];
  seasons: string[];
  /**
   * Three to five compressed sample images as data URLs. They are forwarded to
   * the model and never written to disk or to Supabase.
   */
  thumbnails: string[];
  /**
   * Every photograph in the chapter, in book order, as the facts needed to
   * group them onto pages: when it was taken, roughly where, and which way
   * it faces. No pixels — the model groups by what the pictures have in
   * common, and a date and a place say most of that for a fraction of the
   * cost of sending thirty images.
   */
  photos?: PhotoFacts[];
  /** How many pages this chapter's photographs may be spread over. */
  pageBudget?: { min: number; max: number };
};

export type PhotoFacts = {
  /** Position in the chapter, from 0 — what `pages` refers back to. */
  i: number;
  /** The day it was taken, `YYYY-MM-DD`, when the file says. */
  on?: string;
  /** City or region, when known. */
  place?: string;
  orientation: "portrait" | "landscape" | "square";
};

/** What every provider must return, whatever model produced it. */
export type StoryDraft = {
  title: string;
  dateLabel: string;
  blurb: string;
  /**
   * The chapter's photographs grouped onto pages: one array per page, holding
   * positions from `StoryRequest.photos`. Absent when the request carried no
   * photo facts, or when what came back could not be used — the book then
   * groups them by date itself.
   */
  pages?: number[][];
};

/**
 * A book palette as the model proposes it, before `sanitizePalette` makes it
 * print-safe. Hex colors, `#rrggbb`.
 */
export type BookPaletteOption = {
  /** Short and evocative: "Red collar, golden coat". */
  name: string;
  /** One line on why it suits this pet. Shown to the owner. */
  reason: string;
  paper: string;
  ink: string;
  accent: string;
  tape: string[];
  scraps: string[];
  doodle: string;
};

/**
 * What the pet looks like, from one look at a handful of their photos before
 * any chapter is written. It gives every chapter the same, specific words for
 * the pet ("his red harness") and gives the book its colors.
 */
export type PetProfile = {
  /** Coat, markings, build: "a caramel dog with one flopped ear". */
  appearance: string;
  /** What they wear, when they wear it: collar, harness, bandana, sweater. */
  accessories: { item: string; color: string }[];
  /** Things that keep turning up: a tennis ball, the blue couch, the beach. */
  motifs: string[];
  palettes: BookPaletteOption[];
};

/** What the browser sends to `POST /api/profile`. */
export type ProfileRequest = {
  petName: string;
  species?: string;
  notes?: string;
  /** Up to six compressed photographs, data URLs, cover photo first. */
  thumbnails: string[];
};
