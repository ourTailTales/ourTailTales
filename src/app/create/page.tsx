import type { Metadata } from "next";

import { Funnel } from "@/components/Funnel";

// Reads ?email= from the landing-page CTA via useSearchParams, so this page
// must render per-request rather than be statically generated at build time.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Create your pet's story",
  description:
    "Upload your pet's photo album and turn their memories into a personalized storybook.",
};

export default function CreatePage() {
  return <Funnel />;
}
