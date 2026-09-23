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
  dateLabel: string;
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
};

/** What every provider must return, whatever model produced it. */
export type StoryDraft = {
  title: string;
  dateLabel: string;
  blurb: string;
};
