/**
 * Brand color constants for non-CSS contexts (Stripe appearance, PDF rgb, etc.).
 * Keep in sync with docs/BRAND_GUIDELINES.md and src/app/globals.css.
 */
export const brand = {
  name: "ourTailTales",
  domain: "ourtailtales.com",
  line: "Their life, in chapters.",
  /** Landing / cover title — problem-first hook. */
  title: "Their story is still in your camera roll.",
  /** Hero subtitle — bridges the problem to the free offer. */
  subtitle:
    "Enter your email and we\'ll send their free story straight to your inbox.",
  logo: {
    /** Web-optimized mark for headers and UI. Source master: `logo.png`. */
    src: "/branding/logo-512.png",
    master: "/branding/logo.png",
    alt: "ourTailTales — book with paw print",
  },
  colors: {
    periwinkle: "#5B68C8",
    periwinkleDeep: "#4A56B0",
    periwinkleWash: "#EEF1FB",
    memoryBlue: "#C9D8FA",
    lavender: "#E2D7F5",
    sage: "#C9DED7",
    sageDeep: "#3F6B5C",
    petal: "#EDB8AA",
    ink: "#252A3A",
    inkSoft: "#5A6070",
    inkFaint: "#8B91A0",
    line: "#D5DCEB",
    cloud: "#F7F8FC",
    white: "#FFFFFF",
  },
} as const;

/** pdf-lib rgb helpers (0–1 channels) from brand hex. */
export function hexToRgb01(hex: string): { r: number; g: number; b: number } {
  const cleaned = hex.replace("#", "");
  const n = Number.parseInt(cleaned, 16);
  return {
    r: ((n >> 16) & 255) / 255,
    g: ((n >> 8) & 255) / 255,
    b: (n & 255) / 255,
  };
}
