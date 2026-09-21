import type { CoverFontId, CoverLayoutId, CoverPosition } from "@/types/book";

export const DEFAULT_COVER_LAYOUT: CoverLayoutId = "classic";
export const DEFAULT_COVER_FONT: CoverFontId = "cover";

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
    id: "framed",
    label: "Framed",
    description: "Photo inset in a soft border, mark centered on top.",
  },
  {
    id: "banner",
    label: "Banner",
    description: "A solid color band anchors the bottom of the cover.",
  },
  {
    id: "minimal",
    label: "Minimal",
    description: "One soft vignette over the full photo.",
  },
  {
    id: "sidebar",
    label: "Sidebar",
    description: "A color bar runs down the left edge.",
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

/** Default center-anchored position (%) for the name/years on each layout. */
const DEFAULT_POSITIONS: Record<
  CoverLayoutId,
  { name: CoverPosition; dates: CoverPosition }
> = {
  classic: { name: { x: 30, y: 84 }, dates: { x: 30, y: 91 } },
  framed: { name: { x: 50, y: 87 }, dates: { x: 50, y: 93 } },
  banner: { name: { x: 50, y: 90 }, dates: { x: 50, y: 96 } },
  minimal: { name: { x: 50, y: 50 }, dates: { x: 50, y: 58 } },
  sidebar: { name: { x: 58, y: 86 }, dates: { x: 58, y: 93 } },
};

export function defaultNamePos(layoutId: CoverLayoutId): CoverPosition {
  return DEFAULT_POSITIONS[layoutId]?.name ?? DEFAULT_POSITIONS.classic.name;
}

export function defaultDatesPos(layoutId: CoverLayoutId): CoverPosition {
  return DEFAULT_POSITIONS[layoutId]?.dates ?? DEFAULT_POSITIONS.classic.dates;
}

export function clampCoverPosition(pos: CoverPosition): CoverPosition {
  return {
    x: Math.min(96, Math.max(4, pos.x)),
    y: Math.min(96, Math.max(4, pos.y)),
  };
}
