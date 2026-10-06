/**
 * What a downloaded book is called.
 *
 * Kept apart from the code that renders the PDF, which pulls in the whole PDF
 * library. The editor needs these names up front and the renderer only when
 * somebody actually downloads or orders.
 */
export function teaserFileName(petName: string): string {
  return `ourtailtales-${slug(petName)}-first-pages.pdf`;
}

export function previewFileName(petName: string): string {
  return `ourtailtales-${slug(petName)}-story.pdf`;
}

function slug(petName: string): string {
  return (
    petName
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "pet"
  );
}
