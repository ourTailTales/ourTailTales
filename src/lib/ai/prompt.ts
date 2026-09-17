import type { StoryRequest } from "@/types/story";

/**
 * The editorial rules for chapter copy, kept away from any one vendor's SDK so
 * a provider swap cannot change what the book is allowed to say.
 */
export const STORY_SYSTEM_PROMPT = `You write a short, warm memorial-book chapter introduction for ourTailTales, a service that turns a pet owner's photo album into a printed hardcover life story.

You are given only metadata and three to five representative compressed photographs from one chapter. Write with warmth and restraint.

Absolute rules:
- Use only the supplied metadata and representative images.
- Never invent specific memories, events, relationships, emotions, activities, or locations.
- Never include exact addresses. General city, state/region, and country references are allowed only when supplied.
- If information is uncertain, use general wording rather than guessing.
- Prefer evidential phrasing: "These photographs trace...", "This chapter returns to...", "The camera kept coming back to..."
- Do not mention metadata, EXIF, GPS, coordinates, files, uploads, models, or AI.
- No quotation marks around the title. No emoji. No headings or markdown.

The blurb must be brief: about 35 to 55 words, usually two or three short sentences. Do not pad with sentiment, repetition, or abstract reflections. Stop once the chapter is introduced.`;

/** Renders the chapter's evidence as the user turn. Provider-independent. */
export function buildStoryPrompt(chapter: StoryRequest): string {
  const places = chapter.places
    .map((place) =>
      [place.city, place.region, place.country].filter(Boolean).join(", "),
    )
    .filter(Boolean);

  const lines = [
    chapter.petName
      ? `Pet name: ${chapter.petName}`
      : "The pet's name has not been collected yet. Never invent or assign one.",
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
      ? `${chapter.thumbnails.length} representative photographs from this chapter are attached.`
      : "No representative photographs are attached.",
  ].filter((line): line is string => line !== null);

  return `${lines.join("\n")}

Write this chapter's title (2 to 6 words), a short date label, and a brief 35 to 55 word introduction — two or three sentences, no padding.`;
}
