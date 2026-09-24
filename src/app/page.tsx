import type { Metadata, Viewport } from "next";

import { LandingPage } from "@/components/LandingPage";

/**
 * The landing page opens on a dark photo, so the phone's status bar should be
 * dark too, and the photo should run up underneath it (`viewport-fit=cover`,
 * with the hero padding itself by the safe-area inset). Scoped to this page:
 * every other page is cream and keeps the layout's cream theme colour.
 */
export const viewport: Viewport = {
  viewportFit: "cover",
  themeColor: "#1f2433",
};

export const metadata: Metadata = {
  appleWebApp: { statusBarStyle: "black-translucent" },
};

export default function Home() {
  return <LandingPage />;
}
