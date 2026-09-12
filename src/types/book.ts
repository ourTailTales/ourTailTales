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
  /** What the model said its draft was grounded in. Never printed. */
  confidenceNotes: string[];
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

export type BookMeta = {
  petName: string;
  birthYear: string;
  deathYear: string;
  dedication: string;
  coverPhotoId: string | null;
};

export type Book = {
  meta: BookMeta;
  chapters: Chapter[];
  pages: BookPage[];
};
