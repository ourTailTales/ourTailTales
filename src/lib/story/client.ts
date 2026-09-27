import { MAX_PHOTO_PAGES, MIN_PHOTO_PAGES } from "@/lib/book/page-plan";
import { clusterCentroids, describeSeasons } from "@/lib/geo";
import * as assetStore from "@/lib/photo/assetStore";
import { postHogHeaders } from "@/lib/posthog-client";
import { renderAiThumbnail } from "@/lib/photo/pipeline";
import type { Chapter, PlaceLabel } from "@/types/book";
import type { PhotoAsset } from "@/types/photo";
import type { PetProfile, PhotoFacts, StoryDraft, StoryRequest } from "@/types/story";

/**
 * Representative thumbnails sent per chapter. The product promise is three to
 * five, and `/api/story` rejects more than five. Four: the opener's photo plus
 * three spread across the period is enough to find a scene to write about,
 * and every picture is paid for on every chapter.
 */
const AI_SAMPLES = 4;

export type StoryContext = {
  petName: string;
  birthYear: string;
  deathYear: string;
  species?: string;
  stillHere?: boolean;
  notes?: string;
  profile?: PetProfile;
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
  position?: { chapterNumber: number; chapterCount: number },
  /** Titles and page captions other chapters of this same book have already used. */
  alreadyUsed?: { titles: string[]; captions: string[] },
): Promise<{ story: StoryDraft; places: PlaceLabel[]; spotlightIds: string[] }> {
  const pagePhotos = chapterBodyIds(chapter);
  const { hero, notable } = pickSamples(chapter, pagePhotos, photos);
  const places = await resolvePlaces(chapter, photos, signal);

  const thumbnails: string[] = [];
  const spotlight: number[] = [];
  const spotlightIds: string[] = [];
  // The opener leads, then the notable ones, and a picture that will not
  // render is left out of both lists together — the numbers have to name
  // photographs the model is really looking at, or a page gets a written
  // line about a picture nobody showed it.
  for (const photo of hero ? [hero, ...notable] : notable) {
    const file = assetStore.getFile(photo.id);
    if (!file) continue;
    try {
      thumbnails.push(await blobToDataUrl(await renderAiThumbnail(file)));
    } catch {
      // A single unreadable sample should not fail the chapter.
      continue;
    }
    const at = pagePhotos.indexOf(photo.id);
    if (at === -1) continue;
    spotlight.push(at + 1);
    spotlightIds.push(photo.id);
  }

  const timestamps = chapter.candidateIds
    .map((id) => photos.get(id)?.capturedAt)
    .filter((value): value is number => typeof value === "number");

  const body: StoryRequest = {
    petName: context.petName,
    species: context.species,
    stillHere: context.stillHere,
    notes: context.notes,
    profile: context.profile
      ? {
          appearance: context.profile.appearance,
          accessories: context.profile.accessories,
          motifs: context.profile.motifs,
        }
      : undefined,
    lifespan: [context.birthYear, context.deathYear].filter(Boolean).join("–"),
    dateLabel: chapter.dateLabel,
    chapterNumber: position?.chapterNumber ?? chapter.index + 1,
    chapterCount: position?.chapterCount,
    photoCount: chapter.candidateIds.length,
    selectedCount: chapter.photoIds.length,
    places,
    seasons: describeSeasons(timestamps),
    thumbnails,
    // The pages are the model's to plan: which of these belong together, and
    // how many pages that makes. Facts only — thirty thumbnails a chapter
    // would cost more than the whole book's writing does.
    photos: pagePhotos.map((id, index) => photoFacts(index, photos.get(id), places)),
    spotlight,
    pageBudget: { min: MIN_PHOTO_PAGES, max: MAX_PHOTO_PAGES },
    ...(alreadyUsed && (alreadyUsed.titles.length > 0 || alreadyUsed.captions.length > 0)
      ? { alreadyUsed }
      : {}),
  };

  const response = await fetch("/api/story", {
    method: "POST",
    headers: { ...postHogHeaders(), "Content-Type": "application/json" },
    signal,
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const detail = await safeMessage(response);
    throw new Error(detail);
  }

  const story = (await response.json()) as StoryDraft;
  return { story, places, spotlightIds };
}

/**
 * The chapter's photographs less the one that opens it — the ones the model
 * is grouping onto pages, in the order the book holds them. Derived the same
 * way wherever the plan is read back (`paginateBook`, `applyChapterStory`).
 */
export function chapterBodyIds(chapter: Chapter): string[] {
  const hero = chapter.heroPhotoId ?? chapter.photoIds[0] ?? null;
  return chapter.photoIds.filter((id) => id !== hero);
}

function photoFacts(
  index: number,
  photo: PhotoAsset | undefined,
  places: PlaceLabel[],
): PhotoFacts {
  const taken = photo?.capturedAt ? new Date(photo.capturedAt) : null;
  const place = places[0];
  return {
    // Counting from one, as the prompt says and as a model reads a list.
    i: index + 1,
    ...(taken && !Number.isNaN(taken.getTime())
      ? { on: taken.toISOString().slice(0, 10) }
      : {}),
    ...(place?.city || place?.region ? { place: place.city ?? place.region } : {}),
    orientation: photo?.orientation ?? "landscape",
  };
}

/**
 * The pictures the model gets to look at: the opener, and the best of what
 * comes after it.
 *
 * The rest of the chapter reaches the model as dates and places, which is all
 * a page's line could be written from. These few are the exception, and which
 * few it is now matters twice over — they are the evidence the introduction is
 * built on, and they are the pages that get a line about the animal rather
 * than about the calendar.
 *
 * So they are chosen rather than sampled. Evenly spaced slices of the chapter
 * as before, so the whole span is seen, but the best photograph in each slice
 * instead of whichever one the arithmetic landed on — the notable one, which
 * is the only kind worth writing "pleased with himself" under.
 */
function pickSamples(
  chapter: Chapter,
  body: readonly string[],
  photos: Map<string, PhotoAsset>,
): { hero: PhotoAsset | undefined; notable: PhotoAsset[] } {
  // Same fallback the book itself uses to pick the opener (`chapterBodyIds`,
  // `paginateBook`): a chapter without an explicit hero opens on its first
  // photograph, and the model must be shown the same one it will be judged
  // against, not just whichever `heroPhotoId` happens to say.
  const heroId = chapter.heroPhotoId ?? chapter.photoIds[0] ?? null;
  const hero = heroId ? photos.get(heroId) : undefined;
  const rest = body
    .map((id) => photos.get(id))
    .filter((photo): photo is PhotoAsset => photo !== undefined && photo.id !== hero?.id);
  const wanted = hero ? AI_SAMPLES - 1 : AI_SAMPLES;
  if (rest.length <= wanted) return { hero, notable: rest };

  const notable: PhotoAsset[] = [];
  for (let slice = 0; slice < wanted; slice += 1) {
    const from = Math.floor((slice * rest.length) / wanted);
    const to = Math.floor(((slice + 1) * rest.length) / wanted);
    const best = rest
      .slice(from, Math.max(to, from + 1))
      .reduce((winner, photo) => (photo.qualityScore > winner.qualityScore ? photo : winner));
    notable.push(best);
  }
  return { hero, notable };
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

export async function blobToDataUrl(blob: Blob): Promise<string> {
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

