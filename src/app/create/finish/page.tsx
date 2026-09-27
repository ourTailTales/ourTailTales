import type { Metadata } from "next";

import { Funnel } from "@/components/Funnel";

// The same per-request rendering the editor needs: this reads ?email= too,
// because the editor hands it straight over when somebody finishes a book.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
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
  return <Funnel step="finish" />;
}
