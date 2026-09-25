import type {
  CoverFontId,
  CoverLayoutId,
  CoverNameAnchor,
  CoverPosition,
} from "@/types/book";

export const DEFAULT_COVER_LAYOUT: CoverLayoutId = "classic";
export const DEFAULT_COVER_FONT: CoverFontId = "display";

/**
 * The cover styles a book can be bound in.
 *
 * Three are the customer's photograph edge to edge, one sets it as a framed
 * portrait on the book's own paper, and two carry no photograph at all — the
 * engraved-looking keepsake covers that a great many memorial books actually
 * are, where the name and the years are the whole of the design.
 *
 * Only `classic` comes with the free preview. The rest are part of what an
 * account opens, and the picker shows them locked rather than hiding them:
 * somebody deciding whether to make an account should be able to see what
 * they would be choosing between.
 */
export type CoverLayoutSpec = {
  id: CoverLayoutId;
  label: string;
  description: string;
  /** False for a cover that is type and paper alone. */
  usesPhoto: boolean;
  /** Available without an account. */
  free: boolean;
};

export const COVER_LAYOUTS: CoverLayoutSpec[] = [
  {
    id: "classic",
    label: "Classic",
    description: "Full-bleed photo, their name across the foot.",
    usesPhoto: true,
    free: true,
  },
  {
    id: "minimal",
    label: "Minimal",
    description: "One soft vignette over the full photo.",
    usesPhoto: true,
    free: false,
  },
  {
    id: "editorial",
    label: "Editorial",
    description: "Their name set large across a bold title band.",
    usesPhoto: true,
    free: false,
  },
  {
    id: "portrait",
    label: "Portrait",
    description: "A framed photo on the book's own paper, name beneath.",
    usesPhoto: true,
    free: false,
  },
  {
    id: "keepsake",
    label: "Keepsake",
    description: "No photo: a ruled frame, a paw, their name and years.",
    usesPhoto: false,
    free: false,
  },
  {
    id: "monogram",
    label: "Monogram",
    description: "No photo: their initial set large behind their name.",
    usesPhoto: false,
    free: false,
  },
];

const COVER_BY_ID = new Map(COVER_LAYOUTS.map((layout) => [layout.id, layout]));

export function coverLayoutSpec(id: CoverLayoutId): CoverLayoutSpec {
  return COVER_BY_ID.get(id) ?? COVER_BY_ID.get(DEFAULT_COVER_LAYOUT)!;
}

export function isCoverLayoutId(value: unknown): value is CoverLayoutId {
  return typeof value === "string" && COVER_BY_ID.has(value as CoverLayoutId);
}

/** Whether this cover is one a signed-out reader can actually have. */
export function coverLayoutUnlocked(id: CoverLayoutId, unlocked: boolean): boolean {
  return unlocked || coverLayoutSpec(id).free;
}

/** Whether this cover is drawn from the customer's photograph at all. */
export function coverUsesPhoto(id: CoverLayoutId): boolean {
  return coverLayoutSpec(id).usesPhoto;
}

/**
 * The framed portrait's photo window, and the keepsake frame's two rules, as
 * shares of the cover. One definition for the screen and for the print file.
 */
export const PORTRAIT_WINDOW = { x: 0.125, y: 0.1, w: 0.75, h: 0.58 } as const;
export const PORTRAIT_MAT = 0.022;
export const KEEPSAKE_RULES = [0.085, 0.105] as const;
/**
 * Where a photo-free cover prints the years, and its small dividing rule —
 * far enough below the middle to clear a name set at the default size.
 */
export const PLATE_YEARS_Y = 0.71;
export const PLATE_RULE_Y = 0.645;
export const PLATE_RULE_HALF_WIDTH = 0.07;
/** The paw stamped at the head of the keepsake cover. */
export const KEEPSAKE_PAW = { cy: 0.235, size: 0.11 } as const;
/** The initial set behind a monogram cover. */
export const MONOGRAM_LETTER = { cy: 0.46, size: 0.52, opacity: 0.12 } as const;

export const COVER_FONTS: {
  id: CoverFontId;
  label: string;
  cssVar: string;
}[] = [
  { id: "cover", label: "Cormorant", cssVar: "var(--font-cover)" },
  { id: "display", label: "Merienda", cssVar: "var(--font-display)" },
  { id: "playfair", label: "Playfair", cssVar: "var(--font-playfair)" },
  { id: "caveat", label: "Caveat", cssVar: "var(--font-caveat)" },
  { id: "sans", label: "Inter", cssVar: "var(--font-sans)" },
];

export function coverFontVar(fontId?: CoverFontId): string {
  return (
    COVER_FONTS.find((font) => font.id === fontId)?.cssVar ??
    COVER_FONTS[0].cssVar
  );
}

/** Starting anchor for the pet's name on each layout — the customer can move it. */
const DEFAULT_NAME_ANCHOR: Record<CoverLayoutId, CoverNameAnchor> = {
  classic: "bottom-center",
  minimal: "middle-center",
  editorial: "middle-center",
  portrait: "bottom-center",
  keepsake: "middle-center",
  monogram: "middle-center",
};

export function defaultNameAnchor(layoutId: CoverLayoutId): CoverNameAnchor {
  return DEFAULT_NAME_ANCHOR[layoutId] ?? "middle-center";
}

/** Vertical position (%) for each row of the 3×3 anchor grid. */
const ANCHOR_Y: Record<string, number> = {
  top: 14,
  middle: 50,
  bottom: 87,
};

/** Inset (%) from the cover edge for left/right-pinned text. */
const EDGE_INSET = 8;

/**
 * CSS positioning for the pet-name element on the cover canvas.
 *
 * Left-column anchors pin the text's left edge at a fixed inset — the text
 * grows rightward, so changing font size never shifts its distance from the
 * edge. Right-column mirrors that. Center-column stays centered as before.
 */
export type CoverNameStyle = {
  top: string;
  left?: string;
  right?: string;
  transform: string;
  textAlign: "left" | "center" | "right";
};

export function styleForAnchor(anchor: CoverNameAnchor): CoverNameStyle {
  const [row, col] = anchor.split("-") as [string, string];
  const y = ANCHOR_Y[row] ?? 50;

  if (col === "left") {
    return {
      top: `${y}%`,
      left: `${EDGE_INSET}%`,
      transform: "translateY(-50%)",
      textAlign: "left",
    };
  }
  if (col === "right") {
    return {
      top: `${y}%`,
      right: `${EDGE_INSET}%`,
      transform: "translateY(-50%)",
      textAlign: "right",
    };
  }
  // center
  return {
    top: `${y}%`,
    left: "50%",
    transform: "translate(-50%, -50%)",
    textAlign: "center",
  };
}

/** The 3×3 grid of choices shown in the cover editor, in reading order. */
export const COVER_NAME_ANCHORS: {
  id: CoverNameAnchor;
  label: string;
  /** Dot position (%) inside the small picker square — a miniature of NAME_ANCHOR_POSITIONS. */
  dot: CoverPosition;
}[] = [
  { id: "top-left", label: "Top left", dot: { x: 28, y: 22 } },
  { id: "top-center", label: "Top center", dot: { x: 50, y: 22 } },
  { id: "top-right", label: "Top right", dot: { x: 72, y: 22 } },
  { id: "middle-left", label: "Center left", dot: { x: 28, y: 50 } },
  { id: "middle-center", label: "Center", dot: { x: 50, y: 50 } },
  { id: "middle-right", label: "Center right", dot: { x: 72, y: 50 } },
  { id: "bottom-left", label: "Bottom left", dot: { x: 28, y: 78 } },
  { id: "bottom-center", label: "Bottom center", dot: { x: 50, y: 78 } },
  { id: "bottom-right", label: "Bottom right", dot: { x: 72, y: 78 } },
];

/**
 * Default cover-name size.
 *
 * Not a point size: a share of the cover, spent the same way on screen
 * (`nameSize × 2.5` cqw) and in the print file (`nameSize × 15` pt on the
 * 612pt trim). Six puts a short name across about half the cover, which is
 * how a book title is set — the old 3.75 read like a caption under a
 * photograph, which is what it was.
 */
export const DEFAULT_COVER_NAME_SIZE = 6;

/**
 * The classic cover's scrim, bottom (0) to top (1) of its band, which covers
 * the bottom 36% of the cover. One definition for the CSS gradient and the
 * PDF's embedded ramp, so the printed cover darkens exactly like the screen.
 */
export const CLASSIC_SCRIM_HEIGHT = 0.36;
export const CLASSIC_SCRIM_STOPS = [
  { at: 0, alpha: 0.72 },
  { at: 0.42, alpha: 0.42 },
  { at: 0.78, alpha: 0.1 },
  { at: 1, alpha: 0 },
] as const;

/** Layouts whose name lands on a light (cream/paper) surface instead of the
 * photo — those need dark ink text instead of the usual white. The three
 * quiet covers do: two carry no photograph at all, and the framed portrait
 * sets its name on the paper below the picture. */
const LIGHT_SURFACE_LAYOUTS = new Set<CoverLayoutId>(["portrait", "keepsake", "monogram"]);

export function coverTextTone(layoutId: CoverLayoutId): "light" | "dark" {
  return LIGHT_SURFACE_LAYOUTS.has(layoutId) ? "dark" : "light";
}
