import type { Metadata } from "next";

import { Funnel } from "@/components/Funnel";

export const metadata: Metadata = {
  title: "Create your pet's story",
  description:
    "Upload your pet's photo album and turn their memories into a personalized storybook.",
};

export default function CreatePage() {
  return <Funnel />;
}
