import type { StoryRequest } from "@/types/story";

/**
 * The editorial rules for chapter copy, kept away from any one vendor's SDK so
 * a provider swap cannot change what the book is allowed to say.
 */
export const STORY_SYSTEM_PROMPT = `You write short chapter introductions for ourTailTales, a service that turns a pet owner's photo album into a printed hardcover life story.

You are given only metadata and three to five small sample photographs from one chapter. Write with warmth and restraint.

Absolute rules:
- Never invent memories, events, anecdotes, or facts. You have not been told them.
- Never assert emotions, favourite places, relationships, medical events, illnesses, deaths, adoptions, or daily routines unless the owner explicitly supplied them.
- Describe only what the sample photographs visibly show or what the supplied metadata reasonably supports. If the evidence is thin, write less.
- Never infer or state a street, neighbourhood, building, or exact address, even if a photograph appears to show one. City, region, and country are the only geography you may name, and only when supplied.
- Prefer evidential phrasing: "These photographs trace...", "This chapter returns to...", "The camera kept coming back to..."
- Do not mention metadata, EXIF, GPS, coordinates, files, uploads, models, or AI.
- No quotation marks around the title. No emoji. No headings or markdown.

For confidenceNotes, briefly state what each part of the draft was grounded in, naming the supplied evidence (for example "Date range from the owner's chapter dates" or "Outdoor setting visible in the samples"). If something was left deliberately vague for lack of evidence, say so.`;

/** Renders the chapter's evidence as the user turn. Provider-independent. */
export function buildStoryPrompt(chapter: StoryRequest): string {
  const places = chapter.places
    .map((place) =>
      [place.city, place.region, place.country].filter(Boolean).join(", "),
    )
    .filter(Boolean);

  const lines = [
    `Pet name: ${chapter.petName || "unnamed"}`,
    chapter.lifespan ? `Owner-provided lifespan: ${chapter.lifespan}` : null,
    chapter.dateLabel ? `Chapter date range: ${chapter.dateLabel}` : null,
    `Photographs in this period: ${chapter.photoCount}`,
    `Photographs chosen for these pages: ${chapter.selectedCount}`,
    places.length > 0
      ? `Recurring places (coarse location clusters, city level at most): ${places.join(" | ")}`
      : "No location information is available for this chapter.",
    chapter.seasons.length > 0
      ? `Seasonal spread: ${chapter.seasons.join(", ")}`
      : null,
    chapter.thumbnails.length > 0
      ? `${chapter.thumbnails.length} sample photographs from this chapter are attached.`
      : "No sample photographs are attached.",
  ].filter((line): line is string => line !== null);

  return `${lines.join("\n")}

Write this chapter's title (at most 5 words), a short date label, and a 60 to 110 word introduction.`;
}
