import type { Metadata } from "next";
import { Suspense } from "react";

import { Funnel } from "@/components/Funnel";
import { videoMemoriesEnabled } from "@/lib/video-memory/flag";

export const metadata: Metadata = {
  // One person's book in progress. Nothing here belongs in a search result.
  robots: { index: false, follow: true },
  title: "Create your pet's story",
  description:
    "Upload your pet's photo album and turn their memories into a personalized storybook.",
};

export default function CreatePage() {
  // The funnel reads ?email= in the browser. The boundary lets the page itself
  // be built once and served from the edge, where it used to be rendered on
  // the server for every visit.
  return (
    <Suspense fallback={<FunnelFallback />}>
      <Funnel videoMemoriesEnabled={videoMemoriesEnabled()} />
    </Suspense>
  );
}

function FunnelFallback() {
  return (
    <div className="flex min-h-dvh items-center justify-center">
      <span
        role="status"
        aria-label="Loading"
        className="size-10 animate-spin rounded-full border-[3px] border-periwinkle/25 border-t-periwinkle"
      />
    </div>
  );
}
