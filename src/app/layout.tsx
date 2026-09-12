import type { Metadata, Viewport } from "next";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { DM_Serif_Display, Inter } from "next/font/google";
import { brand } from "@/lib/brand";
import "./globals.css";

const display = DM_Serif_Display({
  variable: "--font-display",
  subsets: ["latin"],
  weight: "400",
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
  themeColor: brand.colors.cloud,
  colorScheme: "light",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${display.variable} ${body.variable} h-full antialiased`}
    >
      <body className="brand-atmosphere min-h-full flex flex-col bg-cloud text-ink">
        {children}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
