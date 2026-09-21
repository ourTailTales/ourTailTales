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
};

export type LayoutId =
  | "full-bleed"
  | "one-large-two-small"
  | "two-vertical"
  | "two-horizontal"
  | "three-editorial"
  | "four-grid"
  | "chapter-opener";

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

export type LayoutDefinition = {
  id: LayoutId;
  slots: Slot[];
  /** Preferred orientation of each slot, used to match photos to layouts. */
  slotShapes: SlotShape[];
  /** Text region for the chapter opener, in the same normalized space. */
  textBox?: Slot;
  /** True when slots run to the page edge and must not be inset. */
  fullBleed?: boolean;
};

export type BookPage = {
  id: string;
  kind: PageKind;
  /** 1-based position in the interior PDF. */
  pageNumber: number;
  layoutId: LayoutId | null;
  photoIds: string[];
  chapterId?: string;
  chapterIndex?: number;
};

/** Free position on the front cover, as a percentage of width/height (0–100), anchored at its center. */
export type CoverPosition = { x: number; y: number };

/** Background composition of the front cover — photo treatment + logo placement. */
export type CoverLayoutId =
  | "classic"
  | "framed"
  | "banner"
  | "minimal"
  | "sidebar";

/** Which typeface renders the name/years on the front cover. */
export type CoverFontId = "cover" | "display" | "playfair" | "caveat" | "sans";

export type BookMeta = {
  petName: string;
  birthYear: string;
  deathYear: string;
  dedication: string;
  coverPhotoId: string | null;
  /** Optional — falls back to DEFAULT_COVER_LAYOUT (see lib/book/coverLayouts). */
  coverLayoutId?: CoverLayoutId;
  /** Optional — falls back to DEFAULT_COVER_FONT. */
  coverFontId?: CoverFontId;
  /** Optional — falls back to that layout's default name position. */
  coverNamePos?: CoverPosition;
  /** Optional — falls back to that layout's default years position. */
  coverDatesPos?: CoverPosition;
  /** Cover name font size in rem units — defaults to layout-dependent value. */
  coverNameSize?: number;
  /** Whether the cover name is bold — defaults to true. */
  coverNameBold?: boolean;
  /** Whether the cover name is underlined — defaults to false. */
  coverNameUnderline?: boolean;
  /** User-added extra text fields on the cover (subtitle, date caption, etc.). */
  coverExtraFields?: CoverTextField[];
};

/** A user-added text field on the cover canvas. */
export type CoverTextField = {
  id: string;
  text: string;
  pos: CoverPosition;
  fontId?: CoverFontId;
  size?: number;
  bold?: boolean;
  underline?: boolean;
};
