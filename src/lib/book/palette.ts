import { brand } from "@/lib/brand";
import type { BookMeta } from "@/types/book";
import type { BookPaletteOption } from "@/types/story";

/**
 * The colors a book's pages are printed in.
 *
 * Chosen per pet: the profile look proposes three palettes built around the
 * animal's coat and what it wears, and the owner can switch between them. The
 * product itself stays on the ourTailTales brand; the book is theirs.
 *
 * A model's color taste is not a model's color *math*, so whatever it
 * proposes goes through `sanitizePalette` first. That is what guarantees the
 * paper is paper, body text is readable on it, and tape reads as tape.
 */
export type BookPalette = {
  paper: string;
  ink: string;
  inkSoft: string;
  inkFaint: string;
  accent: string;
  tape: string[];
  scraps: string[];
  doodle: string;
};

/** The classic ourTailTales book, and the fallback for anything missing. */
export const BRAND_PALETTE: BookPalette = {
  paper: brand.colors.cream,
  ink: brand.colors.ink,
  inkSoft: brand.colors.inkSoft,
  inkFaint: brand.colors.inkFaint,
  accent: brand.colors.periwinkle,
  tape: [brand.colors.lavender, brand.colors.sage, brand.colors.petal, brand.colors.memoryBlue],
  scraps: [brand.colors.memoryBlue, brand.colors.lavender, brand.colors.sage, brand.colors.periwinkleWash],
  doodle: brand.colors.periwinkle,
};

/** The palette a book is printed in: the chosen pet palette, or the classic one. */
export function resolvePalette(
  meta: Pick<BookMeta, "petProfile" | "paletteIndex">,
): BookPalette {
  const index = meta.paletteIndex ?? 0;
  if (index < 0) return BRAND_PALETTE;
  const option = meta.petProfile?.palettes[index] ?? meta.petProfile?.palettes[0];
  return option ? sanitizePalette(option) : BRAND_PALETTE;
}

/* ------------------------------ sanitising ------------------------------ */

/**
 * Makes a proposed palette safe to print:
 * - paper is very light and barely tinted, so photos and text sit on it;
 * - ink reaches 7:1 on the paper, accent and doodles 3:1 (large text, marks);
 * - tape is a light-to-mid pastel, scraps paler still, so neither fights
 *   the photos or disappears into the paper.
 * Anything unreadable as a color falls back to the classic value.
 */
export function sanitizePalette(option: Partial<BookPaletteOption>): BookPalette {
  const paper = clampLab(parseHex(option.paper) ?? parseHex(BRAND_PALETTE.paper)!, {
    minL: 94,
    maxL: 98.5,
    maxChroma: 8,
  });
  const paperHex = toHex(paper);

  const ink = ensureContrast(parseHex(option.ink) ?? parseHex(BRAND_PALETTE.ink)!, paper, 7, {
    maxChroma: 30,
  });
  const accent = ensureContrast(
    parseHex(option.accent) ?? parseHex(BRAND_PALETTE.accent)!,
    paper,
    3.2,
  );
  const doodle = ensureContrast(
    parseHex(option.doodle) ?? parseHex(option.accent) ?? parseHex(BRAND_PALETTE.doodle)!,
    paper,
    2.6,
  );

  const inkLab = rgbToLab(ink);
  const inkSoft = ensureContrast(labToRgb({ ...inkLab, L: Math.min(inkLab.L + 28, 48) }), paper, 4.8);
  const inkFaint = ensureContrast(labToRgb({ ...inkLab, L: Math.min(inkLab.L + 45, 62) }), paper, 3);

  const tape = fillTo(
    (option.tape ?? []).map(parseHex).filter(isRgb),
    BRAND_PALETTE.tape.map((hex) => parseHex(hex)!),
    4,
  ).map((color) => toHex(clampLab(color, { minL: 72, maxL: 90, maxChroma: 42, minChroma: 10 })));

  const scraps = fillTo(
    (option.scraps ?? []).map(parseHex).filter(isRgb),
    BRAND_PALETTE.scraps.map((hex) => parseHex(hex)!),
    3,
  ).map((color) => toHex(clampLab(color, { minL: 86, maxL: 95, maxChroma: 22, minChroma: 4 })));

  return {
    paper: paperHex,
    ink: toHex(ink),
    inkSoft: toHex(inkSoft),
    inkFaint: toHex(inkFaint),
    accent: toHex(accent),
    tape,
    scraps,
    doodle: toHex(doodle),
  };
}

function fillTo<T>(values: T[], fallback: T[], count: number): T[] {
  const out = values.slice(0, count);
  for (let index = 0; out.length < count; index += 1) out.push(fallback[index % fallback.length]!);
  return out;
}

/* ------------------------------ color math ------------------------------ */

export type Rgb = { r: number; g: number; b: number };
type Lab = { L: number; a: number; b: number };

function isRgb(value: Rgb | null): value is Rgb {
  return value !== null;
}

export function parseHex(value: string | undefined | null): Rgb | null {
  const match = /^#?([0-9a-f]{6})$/i.exec(value?.trim() ?? "");
  if (!match) return null;
  const n = Number.parseInt(match[1]!, 16);
  return { r: ((n >> 16) & 255) / 255, g: ((n >> 8) & 255) / 255, b: (n & 255) / 255 };
}

export function toHex({ r, g, b }: Rgb): string {
  const channel = (value: number): string =>
    Math.round(Math.min(1, Math.max(0, value)) * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${channel(r)}${channel(g)}${channel(b)}`;
}

function toLinear(value: number): number {
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

function fromLinear(value: number): number {
  return value <= 0.0031308 ? value * 12.92 : 1.055 * value ** (1 / 2.4) - 0.055;
}

export function relativeLuminance(color: Rgb): number {
  return 0.2126 * toLinear(color.r) + 0.7152 * toLinear(color.g) + 0.0722 * toLinear(color.b);
}

export function contrastRatio(a: Rgb, b: Rgb): number {
  const [light, dark] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x);
  return (light! + 0.05) / (dark! + 0.05);
}

const WHITE_X = 0.95047;
const WHITE_Z = 1.08883;

function rgbToLab(color: Rgb): Lab {
  const r = toLinear(color.r);
  const g = toLinear(color.g);
  const b = toLinear(color.b);
  const x = (r * 0.4124 + g * 0.3576 + b * 0.1805) / WHITE_X;
  const y = r * 0.2126 + g * 0.7152 + b * 0.0722;
  const z = (r * 0.0193 + g * 0.1192 + b * 0.9505) / WHITE_Z;
  const f = (t: number): number => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  return { L: 116 * f(y) - 16, a: 500 * (f(x) - f(y)), b: 200 * (f(y) - f(z)) };
}

function labToRgb({ L, a, b }: Lab): Rgb {
  const fy = (L + 16) / 116;
  const fx = fy + a / 500;
  const fz = fy - b / 200;
  const inv = (t: number): number => (t ** 3 > 0.008856 ? t ** 3 : (t - 16 / 116) / 7.787);
  const x = inv(fx) * WHITE_X;
  const y = inv(fy);
  const z = inv(fz) * WHITE_Z;
  const r = x * 3.2406 + y * -1.5372 + z * -0.4986;
  const g = x * -0.9689 + y * 1.8758 + z * 0.0415;
  const bl = x * 0.0557 + y * -0.204 + z * 1.057;
  const clip = (value: number): number => Math.min(1, Math.max(0, fromLinear(Math.min(1, Math.max(0, value)))));
  return { r: clip(r), g: clip(g), b: clip(bl) };
}

/** Pulls a color's lightness and saturation into a range, keeping its hue. */
function clampLab(
  color: Rgb,
  range: { minL: number; maxL: number; maxChroma: number; minChroma?: number },
): Rgb {
  const lab = rgbToLab(color);
  const chroma = Math.hypot(lab.a, lab.b);
  const L = Math.min(range.maxL, Math.max(range.minL, lab.L));
  let target = Math.min(range.maxChroma, chroma);
  if (range.minChroma !== undefined && chroma > 0.5) target = Math.max(range.minChroma, target);
  const scale = chroma > 0 ? target / chroma : 0;
  return labToRgb({ L, a: lab.a * scale, b: lab.b * scale });
}

/** Darkens (keeping hue) until the color reaches `ratio` against the paper. */
function ensureContrast(
  color: Rgb,
  paper: Rgb,
  ratio: number,
  options: { maxChroma?: number } = {},
): Rgb {
  const lab = rgbToLab(color);
  let chroma = Math.hypot(lab.a, lab.b);
  const scale = options.maxChroma !== undefined && chroma > options.maxChroma ? options.maxChroma / chroma : 1;
  chroma *= scale;
  let candidate = labToRgb({ L: lab.L, a: lab.a * scale, b: lab.b * scale });
  for (let L = lab.L; contrastRatio(candidate, paper) < ratio && L > 0; L -= 2) {
    candidate = labToRgb({ L, a: lab.a * scale, b: lab.b * scale });
  }
  return candidate;
}

/** Mixes two colors, `t` of the way from `a` to `b`. Unreadable input returns `a`. */
export function mixHex(a: string, b: string, t: number): string {
  const from = parseHex(a);
  const to = parseHex(b);
  if (!from || !to) return a;
  const mix = (x: number, y: number): number => x + (y - x) * t;
  return toHex({ r: mix(from.r, to.r), g: mix(from.g, to.g), b: mix(from.b, to.b) });
}
