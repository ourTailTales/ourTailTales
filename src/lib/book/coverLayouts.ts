import type {
  CoverFontId,
  CoverLayoutId,
  CoverNameAnchor,
  CoverPosition,
} from "@/types/book";

export const DEFAULT_COVER_LAYOUT: CoverLayoutId = "classic";
export const DEFAULT_COVER_FONT: CoverFontId = "display";

export const COVER_LAYOUTS: {
  id: CoverLayoutId;
  label: string;
  description: string;
}[] = [
  {
    id: "classic",
    label: "Classic",
    description: "Full-bleed photo with the mark tucked in the corner.",
  },
  {
    id: "minimal",
    label: "Minimal",
    description: "One soft vignette over the full photo.",
  },
  {
    id: "editorial",
    label: "Editorial",
    description: "Their name set large across a bold title band.",
  },
];

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
  classic: "bottom-left",
  minimal: "middle-center",
  editorial: "middle-center",
};

export function defaultNameAnchor(layoutId: CoverLayoutId): CoverNameAnchor {
  return DEFAULT_NAME_ANCHOR[layoutId] ?? "middle-center";
}

/** Vertical position (%) for each row of the 3×3 anchor grid. */
const ANCHOR_Y: Record<string, number> = {
  top: 14,
  middle: 50,
  bottom: 86,
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

/** Default cover-name size (rem) — one notch up from the old default, which read too small. */
export const DEFAULT_COVER_NAME_SIZE = 2.5;

/** Layouts whose name lands on a light (cream/paper) surface instead of
 * the photo — those need dark ink text instead of the usual white. None of
 * the current layouts do; kept so a future light-surface layout only needs
 * to be added here. */
const LIGHT_SURFACE_LAYOUTS = new Set<CoverLayoutId>([]);

export function coverTextTone(layoutId: CoverLayoutId): "light" | "dark" {
  return LIGHT_SURFACE_LAYOUTS.has(layoutId) ? "dark" : "light";
}
