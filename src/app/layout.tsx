import type { Metadata, Viewport } from "next";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Cormorant_Garamond, Inter, Merienda } from "next/font/google";
import { brand } from "@/lib/brand";
import "./globals.css";

const display = Merienda({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["400", "700"],
});

/** Literary cover titles — distinct from UI display. */
const cover = Cormorant_Garamond({
  variable: "--font-cover",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

const body = Inter({
  variable: "--font-body",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: `${brand.name} — ${brand.line}`,
  description:
    "Drop in your pet's photo album. ourTailTales organizes the years, builds the chapters, and creates a hardcover book you can keep forever.",
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? `https://${brand.domain}`,
  ),
  openGraph: {
    title: `${brand.name} — ${brand.line}`,
    description:
      "Turn their camera roll into the story of their life. A hardcover keepsake from the moments you shared.",
    siteName: brand.name,
    type: "website",
    images: [{ url: brand.logo.src, width: 512, height: 512, alt: brand.name }],
  },
};

export const viewport: Viewport = {
  themeColor: "#161924",
  colorScheme: "dark",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${display.variable} ${cover.variable} ${body.variable} brand-atmosphere antialiased`}
    >
      <body className="min-h-dvh flex flex-col text-ink">
        {children}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
