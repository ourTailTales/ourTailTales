import type { PetProfile } from "@/types/story";

export type PlaceLabel = {
  city?: string;
  region?: string;
  country?: string;
};

export type AiStatus = "idle" | "pending" | "done" | "error";

export type Chapter = {
  id: string;
  /** Zero-based position in the book. */
  index: number;
  /** Selected photos, in placement order. */
  photoIds: string[];
  /** Every photo inside this chapter's date range, for swaps. */
  candidateIds: string[];
  startAt: number | null;
  endAt: number | null;
  title: string;
  dateLabel: string;
  blurb: string;
  places: PlaceLabel[];
  heroPhotoId: string | null;
  aiStatus: AiStatus;
  aiError?: string;
  /**
   * Layouts the customer chose for this chapter's photo pages, by page
   * (0 is the first page after the opener). Null or missing means "let the
   * book decide". Kept on the chapter rather than on the page because pages
   * are rebuilt from chapters on every edit, and a chosen layout has to
   * survive that.
   */
  pageLayouts?: (PhotoLayoutId | null)[];
  /**
   * The owner's words for this chapter's photo pages, by page and then by the
   * layout's note slot (at most two). Kept beside `pageLayouts`, and for the
   * same reason: pages are rebuilt from chapters on every edit, so anything
   * written on a page has to live on the chapter to survive.
   *
   * A missing or empty entry is not a missing caption — a `caption-*` layout
   * falls back to what the book already knows about the page (see
   * `pageNotes` in `lib/book/design/common`).
   */
  pageNotes?: ((string | null)[] | null)[];
};

/**
 * The photo-page layouts every design offers (see `lib/book/layouts`).
 *
 * Ten are photographs alone. The twelve `caption-*` layouts keep room for the
 * owner's own words beside, before, or under the pictures — one note per
 * photo, never more than two on a page.
 */
export type PhotoLayoutId =
  | "full-bleed"
  | "single-framed"
  | "two-vertical"
  | "two-horizontal"
  | "one-large-two-small"
  | "three-editorial"
  | "four-grid"
  | "one-large-three-small"
  | "five-mosaic"
  | "six-grid"
  | "caption-right-1"
  | "caption-right-2"
  | "caption-right-3"
  | "caption-right-4"
  | "caption-left-1"
  | "caption-left-2"
  | "caption-left-3"
  | "caption-left-4"
  | "caption-below-1"
  | "caption-below-2"
  | "caption-below-3"
  | "caption-below-4"
  | "note-page";

export type LayoutId = PhotoLayoutId | "chapter-opener";

/** The look of the whole book's pages (see `lib/book/design`). */
export type DesignId = "scrapbook" | "classic" | "modern" | "vintage";

export type PageKind =
  | "title"
  | "dedication"
  | "chapter-opener"
  | "photos"
  | "closing"
  | "imprint";

/** A rectangle in normalized page space (0..1 of the full bleed page). */
export type Slot = {
  x: number;
  y: number;
  w: number;
  h: number;
};

export type SlotShape = "portrait" | "landscape" | "square" | "any";

export type BookPage = {
  id: string;
  kind: PageKind;
  /** 1-based position in the interior PDF. */
  pageNumber: number;
  layoutId: LayoutId | null;
  photoIds: string[];
  chapterId?: string;
  chapterIndex?: number;
  /** Which of its chapter's photo pages this is, from 0 — photo pages only. */
  chapterPageIndex?: number;
  /**
   * The owner's words for this page, one per note slot in its layout, carried
   * over from the chapter so a design never has to go looking for them. Null
   * where they wrote nothing and the page falls back to its own date.
   */
  notes?: (string | null)[];
};

/** Free position on the front cover, as a percentage of width/height (0–100), anchored at its center. */
export type CoverPosition = { x: number; y: number };

/**
 * The front cover's composition.
 *
 * The first four are built on the owner's photograph; `keepsake` and
 * `monogram` carry none at all — a plain, engraved-looking cover in the
 * book's own colors, which is what a great many memorial books actually are.
 */
export type CoverLayoutId =
  | "classic"
  | "minimal"
  | "editorial"
  | "portrait"
  | "keepsake"
  | "monogram";

/** Which typeface renders the pet's name on the front cover. */
export type CoverFontId = "cover" | "display" | "playfair" | "caveat" | "sans";

/** Where the pet's name sits on the front cover — a 3×3 grid, like a caption anchor. */
export type CoverNameAnchor =
  | "top-left"
  | "top-center"
  | "top-right"
  | "middle-left"
  | "middle-center"
  | "middle-right"
  | "bottom-left"
  | "bottom-center"
  | "bottom-right";

/**
 * A print-ready front+spine+back cover the customer uploaded themselves,
 * sized to Lulu's exact requirement for the book's current chapter count —
 * used in place of the in-app designed cover when set. The binary lives in
 * `lib/book/customCoverStore` (module-level, like photo/video assets); this
 * is just the metadata that travels through state and the local draft.
 */
export type CustomCoverMeta = {
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  /** Interior page count this file's dimensions were checked against — if the
   * chapter count changes afterward, this no longer matches and needs a re-check. */
  validatedForPages: number;
  widthPt: number;
  heightPt: number;
};

export type BookMeta = {
  petName: string;
  birthYear: string;
  deathYear: string;
  dedication: string;
  coverPhotoId: string | null;
  /**
   * What kind of animal they are, in the owner's own word — "dog", "cat",
   * "rabbit". The writer cannot tell a whippet from a greyhound from four
   * compressed thumbnails, and guessing wrong in a book about someone's pet is
   * unforgivable, so it is asked rather than inferred.
   */
  species?: string;
  /**
   * Whether the pet is alive. Decides whether the book reads as a life being
   * celebrated or a life being remembered — the single biggest lever on tone,
   * and not something an empty death year can be trusted to imply.
   */
  stillHere?: boolean;
  /**
   * One line the owner wanted us to know. The only piece of the book that
   * comes from them rather than from the photographs, and usually the piece
   * that makes it sound like their pet.
   */
  notes?: string;
  /**
   * The page design. Optional — falls back to Scrapbook, which is also what
   * every free preview is printed in; the other designs are for account
   * holders to switch to.
   */
  designId?: DesignId;
  /** Optional — falls back to DEFAULT_COVER_LAYOUT (see lib/book/coverLayouts). */
  coverLayoutId?: CoverLayoutId;
  /** Optional — falls back to DEFAULT_COVER_FONT. */
  coverFontId?: CoverFontId;
  /** Optional — falls back to that layout's default anchor. */
  coverNameAnchor?: CoverNameAnchor;
  /** Cover name font size in rem units — defaults to DEFAULT_COVER_NAME_SIZE. */
  coverNameSize?: number;
  /** Whether the cover name is bold — defaults to true. */
  coverNameBold?: boolean;
  /** Whether the cover name is underlined — defaults to false. */
  coverNameUnderline?: boolean;
  /**
   * What the pet looks like and the palettes proposed for their book, from
   * one look at their photos before the chapters were written.
   */
  petProfile?: PetProfile;
  /**
   * Which of `petProfile.palettes` the book uses: 0 by default, -1 for the
   * classic ourTailTales colors.
   */
  paletteIndex?: number;
};
