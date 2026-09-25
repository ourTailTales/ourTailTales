import * as assetStore from "@/lib/photo/assetStore";
import { selectablePhotos } from "@/lib/photo/dedupe";
import { renderAiThumbnail } from "@/lib/photo/pipeline";
import { blobToDataUrl } from "@/lib/story/client";
import type { BookMeta, Chapter } from "@/types/book";
import type { PhotoAsset } from "@/types/photo";
import type { PetProfile } from "@/types/story";

/** Photographs the profile look gets; `/api/profile` accepts at most six. */
const PROFILE_SAMPLES = 6;

/**
 * Looks at the pet once, before the chapters are written.
 *
 * The cover photo leads (the owner picked it, so the pet is surely in it),
 * then each chapter's opening photo, spread across the whole album so a
 * collar worn one summer and a sweater worn one winter are both seen.
 */
export async function generatePetProfile(
  args: {
    meta: BookMeta;
    chapters: Chapter[];
    photos: PhotoAsset[];
  },
  signal?: AbortSignal,
): Promise<PetProfile> {
  const samples = pickProfileSamples(args);

  const thumbnails: string[] = [];
  for (const photo of samples) {
    const file = assetStore.getFile(photo.id);
    if (!file) continue;
    try {
      thumbnails.push(await blobToDataUrl(await renderAiThumbnail(file)));
    } catch {
      // One unreadable photo should not cost the book its colors.
    }
  }
  if (thumbnails.length === 0) throw new Error("No photos could be read for the profile.");

  const response = await fetch("/api/profile", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal,
    body: JSON.stringify({
      petName: args.meta.petName,
      species: args.meta.species,
      notes: args.meta.notes,
      thumbnails,
    }),
  });
  if (!response.ok) throw new Error("The book's colors could not be chosen.");
  return (await response.json()) as PetProfile;
}

export function pickProfileSamples(args: {
  meta: BookMeta;
  chapters: Chapter[];
  photos: PhotoAsset[];
}): PhotoAsset[] {
  const byId = new Map(args.photos.map((photo) => [photo.id, photo]));
  const picked: PhotoAsset[] = [];
  const add = (id: string | null | undefined): void => {
    const photo = id ? byId.get(id) : undefined;
    if (photo && !picked.includes(photo) && picked.length < PROFILE_SAMPLES) {
      picked.push(photo);
    }
  };

  add(args.meta.coverPhotoId);

  const heroes = args.chapters.map((chapter) => chapter.heroPhotoId ?? chapter.photoIds[0]);
  const step = Math.max(1, heroes.length / (PROFILE_SAMPLES - picked.length || 1));
  for (let index = 0; index < heroes.length && picked.length < PROFILE_SAMPLES; index += step) {
    add(heroes[Math.floor(index)]);
  }

  // A short album: fill from whatever is left.
  for (const photo of selectablePhotos(args.photos)) {
    if (picked.length >= PROFILE_SAMPLES) break;
    add(photo.id);
  }
  return picked;
}
