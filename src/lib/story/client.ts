import { clusterCentroids, describeSeasons } from "@/lib/geo";
import * as assetStore from "@/lib/photo/assetStore";
import { renderAiThumbnail } from "@/lib/photo/pipeline";
import type { Chapter, PlaceLabel } from "@/types/book";
import type { PhotoAsset } from "@/types/photo";
import type { StoryDraft, StoryRequest } from "@/types/story";

/**
 * Representative thumbnails sent per chapter. The product promise is three to
 * five, and `/api/story` rejects more than five.
 */
const AI_SAMPLES = 4;

export type StoryContext = {
  petName: string;
  birthYear: string;
  deathYear: string;
  species?: string;
  stillHere?: boolean;
  notes?: string;
};

/**
 * Generates the title and blurb for one chapter.
 *
 * The larger AI thumbnails are rendered on demand here and dropped as soon as
 * the request resolves — they are never retained in state or stored server-side.
 */
export async function generateChapterStory(
  chapter: Chapter,
  photos: Map<string, PhotoAsset>,
  context: StoryContext,
  signal?: AbortSignal,
): Promise<{ story: StoryDraft; places: PlaceLabel[] }> {
  const samples = pickSamples(chapter, photos);
  const places = await resolvePlaces(chapter, photos, signal);

  const thumbnails: string[] = [];
  for (const photo of samples) {
    const file = assetStore.getFile(photo.id);
    if (!file) continue;
    try {
      thumbnails.push(await blobToDataUrl(await renderAiThumbnail(file)));
    } catch {
      // A single unreadable sample should not fail the chapter.
    }
  }

  const timestamps = chapter.candidateIds
    .map((id) => photos.get(id)?.capturedAt)
    .filter((value): value is number => typeof value === "number");

  const body: StoryRequest = {
    petName: context.petName,
    species: context.species,
    stillHere: context.stillHere,
    notes: context.notes,
    lifespan: [context.birthYear, context.deathYear].filter(Boolean).join("–"),
    dateLabel: chapter.dateLabel,
    photoCount: chapter.candidateIds.length,
    selectedCount: chapter.photoIds.length,
    places,
    seasons: describeSeasons(timestamps),
    thumbnails,
  };

  const response = await fetch("/api/story", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal,
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const detail = await safeMessage(response);
    throw new Error(detail);
  }

  const story = (await response.json()) as StoryDraft;
  return { story, places };
}

/** Spreads samples across the chapter so the AI sees its whole span. */
function pickSamples(
  chapter: Chapter,
  photos: Map<string, PhotoAsset>,
): PhotoAsset[] {
  const available = chapter.photoIds
    .map((id) => photos.get(id))
    .filter((photo): photo is PhotoAsset => photo !== undefined);

  if (available.length <= AI_SAMPLES) return available;

  const step = available.length / AI_SAMPLES;
  return Array.from(
    { length: AI_SAMPLES },
    (_, index) => available[Math.floor(index * step)],
  );
}

async function resolvePlaces(
  chapter: Chapter,
  photos: Map<string, PhotoAsset>,
  signal?: AbortSignal,
): Promise<PlaceLabel[]> {
  const points = chapter.candidateIds
    .map((id) => photos.get(id))
    .filter(
      (photo): photo is PhotoAsset =>
        photo?.lat !== undefined && photo?.lng !== undefined,
    )
    .map((photo) => ({ lat: photo.lat!, lng: photo.lng! }));

  if (points.length === 0) return [];

  const clusters = clusterCentroids(points);
  if (clusters.length === 0) return [];

  try {
    const response = await fetch("/api/geocode", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal,
      body: JSON.stringify({
        points: clusters.map((cluster) => cluster.centroid),
      }),
    });
    if (!response.ok) return [];
    const data = (await response.json()) as { places: PlaceLabel[] };
    return data.places ?? [];
  } catch {
    // The book still works with dates alone.
    return [];
  }
}

async function blobToDataUrl(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return `data:${blob.type || "image/jpeg"};base64,${btoa(binary)}`;
}

async function safeMessage(response: Response): Promise<string> {
  try {
    const data = (await response.json()) as { error?: string };
    return data.error ?? `Story generation failed (${response.status})`;
  } catch {
    return `Story generation failed (${response.status})`;
  }
}

export function placeSummary(places: PlaceLabel[]): string {
  return places
    .map((place) =>
      [place.city, place.region, place.country].filter(Boolean).join(", "),
    )
    .filter(Boolean)
    .join(" · ");
}
