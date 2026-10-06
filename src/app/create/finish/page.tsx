import type { Metadata } from "next";
import { Suspense } from "react";

import { Funnel } from "@/components/Funnel";
import { videoMemoriesEnabled } from "@/lib/video-memory/flag";

export const metadata: Metadata = {
  // One person's book in progress. Nothing here belongs in a search result.
  robots: { index: false, follow: true },
  title: "Finish and order your book",
  description:
    "Check your book over, see what it costs, and order the hardcover or the PDF.",
};

/**
 * Finishing the book has its own address.
 *
 * It used to be a flag inside the editor: "Finish and order" swapped the
 * studio for a price list without the URL moving, so the back button left the
 * page entirely, the step could not be linked to or returned to, and an
 * accidental reload put somebody back in the editor wondering where the
 * checkout had gone. It is a step of its own in every other respect, so it is
 * a route of its own now — and the one after it, `/checkout`, already was.
 */
export default function FinishPage() {
  // The funnel reads ?email= in the browser. The boundary lets the page itself
  // be built once and served from the edge, where it used to be rendered on
  // the server for every visit.
  return (
    <Suspense fallback={<FunnelFallback />}>
      <Funnel step="finish" videoMemoriesEnabled={videoMemoriesEnabled()} />
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
