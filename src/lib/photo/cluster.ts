import {
  compareChronologically,
  hammingHex,
  selectablePhotos,
} from "@/lib/photo/dedupe";
import { MIN_PHOTOS_PER_CHAPTER } from "@/lib/pricing";
import type { Chapter } from "@/types/book";
import type { PhotoAsset } from "@/types/photo";

const TIME_WEIGHT = 0.65;
const DISTANCE_WEIGHT = 0.35;

/** Selected photos per chapter: 1 hero + 2-3 on each of 9 photo pages. */
const SELECTION_TARGET = 26;

/** dHash distance under which a photo adds nothing new to the chapter. */
const REDUNDANT_BITS = 12;

/**
 * Builds the chapter timeline deterministically. The AI never decides
 * chronology; it only names and summarizes what this produces.
 */
export function proposeChapters(
  photos: PhotoAsset[],
  chapterCount: number,
): Chapter[] {
  const ordered = selectablePhotos(photos).sort(compareChronologically);
  if (ordered.length === 0 || chapterCount < 1) return [];

  const segments = splitIntoSegments(ordered, chapterCount);

  return segments.map((segment, index) => {
    const selected = selectRepresentatives(segment, SELECTION_TARGET);
    const hero = pickHero(selected);
    const dated = segment
      .map((photo) => photo.capturedAt)
      .filter((value): value is number => value !== null);

    const startAt = dated.at(0) ?? null;
    const endAt = dated.at(-1) ?? null;

    return {
      id: `chapter-${index + 1}`,
      index,
      photoIds: selected.map((photo) => photo.id),
      candidateIds: segment.map((photo) => photo.id),
      startAt,
      endAt,
      title: `Chapter ${index + 1}`,
      dateLabel: formatDateLabel(startAt, endAt),
      blurb: "",
      places: [],
      heroPhotoId: hero?.id ?? null,
      aiStatus: "idle",
    };
  });
}

/* -------------------------------- boundaries -------------------------------- */

function splitIntoSegments(
  ordered: PhotoAsset[],
  chapterCount: number,
): PhotoAsset[][] {
  const floor = Math.max(
    1,
    Math.min(MIN_PHOTOS_PER_CHAPTER, Math.floor(ordered.length / chapterCount)),
  );

  const breakpoints = pickBreakpoints(ordered, chapterCount, floor);
  const segments =
    breakpoints.length === chapterCount - 1
      ? sliceAt(ordered, breakpoints)
      : evenSegments(ordered, chapterCount);

  // A chapter thinner than the floor would produce padded or empty pages.
  if (segments.some((segment) => segment.length < floor)) {
    return evenSegments(ordered, chapterCount);
  }
  return segments;
}

/**
 * Scores every adjacent pair by time gap and location change, then takes the
 * strongest breaks that still leave every chapter above the floor.
 */
function pickBreakpoints(
  ordered: PhotoAsset[],
  chapterCount: number,
  floor: number,
): number[] {
  const wanted = chapterCount - 1;
  if (wanted <= 0) return [];

  const gaps = ordered.slice(0, -1).map((photo, index) => {
    const next = ordered[index + 1];
    return {
      /** Break happens between index and index + 1. */
      at: index + 1,
      days: daysBetween(photo, next),
      km: kmBetween(photo, next),
    };
  });

  const maxLogDays = Math.max(...gaps.map((gap) => Math.log1p(gap.days)), 1e-6);
  const maxLogKm = Math.max(...gaps.map((gap) => Math.log1p(gap.km)), 1e-6);

  const scored = gaps
    .map((gap) => ({
      at: gap.at,
      score:
        (Math.log1p(gap.days) / maxLogDays) * TIME_WEIGHT +
        (Math.log1p(gap.km) / maxLogKm) * DISTANCE_WEIGHT,
    }))
    .sort((a, b) => b.score - a.score);

  const accepted: number[] = [];
  for (const candidate of scored) {
    if (accepted.length === wanted) break;
    if (respectsFloor(accepted, candidate.at, ordered.length, floor)) {
      accepted.push(candidate.at);
      accepted.sort((a, b) => a - b);
    }
  }

  return accepted.length === wanted ? accepted : [];
}

function respectsFloor(
  accepted: number[],
  candidate: number,
  total: number,
  floor: number,
): boolean {
  const bounds = [0, ...accepted, total].sort((a, b) => a - b);
  for (let i = 0; i < bounds.length - 1; i += 1) {
    if (candidate > bounds[i] && candidate < bounds[i + 1]) {
      return candidate - bounds[i] >= floor && bounds[i + 1] - candidate >= floor;
    }
  }
  return false;
}

function sliceAt(ordered: PhotoAsset[], breakpoints: number[]): PhotoAsset[][] {
  const bounds = [0, ...breakpoints, ordered.length];
  const segments: PhotoAsset[][] = [];
  for (let i = 0; i < bounds.length - 1; i += 1) {
    segments.push(ordered.slice(bounds[i], bounds[i + 1]));
  }
  return segments;
}

function evenSegments(ordered: PhotoAsset[], count: number): PhotoAsset[][] {
  const segments: PhotoAsset[][] = [];
  const base = Math.floor(ordered.length / count);
  let remainder = ordered.length % count;
  let cursor = 0;

  for (let i = 0; i < count; i += 1) {
    const size = base + (remainder > 0 ? 1 : 0);
    if (remainder > 0) remainder -= 1;
    segments.push(ordered.slice(cursor, cursor + size));
    cursor += size;
  }
  return segments;
}

/* ------------------------------- representatives ------------------------------ */

/**
 * Picks the photos that actually get placed. Temporal bins stop one afternoon
 * from dominating a multi-year chapter; the top-up pass then favors quality,
 * fresh content, and orientation variety.
 */
export function selectRepresentatives(
  segment: PhotoAsset[],
  target: number,
): PhotoAsset[] {
  if (segment.length <= target) return [...segment];

  const bins = binByTime(segment, target);
  const picked: PhotoAsset[] = [];
  const pickedIds = new Set<string>();

  for (const bin of bins) {
    if (bin.length === 0) continue;
    const best = bin.reduce((winner, photo) =>
      photo.qualityScore > winner.qualityScore ? photo : winner,
    );
    picked.push(best);
    pickedIds.add(best.id);
    if (picked.length >= target) break;
  }

  if (picked.length < target) {
    const remaining = segment.filter((photo) => !pickedIds.has(photo.id));
    remaining.sort(
      (a, b) => topUpScore(b, picked) - topUpScore(a, picked),
    );
    for (const photo of remaining) {
      if (picked.length >= target) break;
      picked.push(photo);
      pickedIds.add(photo.id);
    }
  }

  return picked.sort(compareChronologically);
}

function binByTime(segment: PhotoAsset[], binCount: number): PhotoAsset[][] {
  const bins: PhotoAsset[][] = Array.from({ length: binCount }, () => []);
  const dated = segment
    .map((photo) => photo.capturedAt)
    .filter((value): value is number => value !== null);

  const first = dated.at(0) ?? null;
  const last = dated.at(-1) ?? null;
  const span = first !== null && last !== null ? last - first : 0;

  segment.forEach((photo, index) => {
    const bin =
      span > 0 && photo.capturedAt !== null
        ? Math.min(
            binCount - 1,
            Math.floor(((photo.capturedAt - first!) / span) * binCount),
          )
        : Math.min(
            binCount - 1,
            Math.floor((index / segment.length) * binCount),
          );
    bins[bin].push(photo);
  });

  return bins;
}

function topUpScore(photo: PhotoAsset, picked: PhotoAsset[]): number {
  let score = photo.qualityScore;

  const redundant = picked.some(
    (other) => hammingHex(photo.dHash, other.dHash) <= REDUNDANT_BITS,
  );
  if (redundant) score -= 0.35;

  const sameOrientation = picked.filter(
    (other) => other.orientation === photo.orientation,
  ).length;
  const share = picked.length > 0 ? sameOrientation / picked.length : 0;
  if (share > 0.7) score -= 0.12;

  if (photo.lat !== undefined) {
    const nearby = picked.filter(
      (other) => other.lat !== undefined && kmBetween(photo, other) < 0.25,
    ).length;
    if (nearby >= 3) score -= 0.1;
  }

  return score;
}

/** The opener slot is landscape, so a strong landscape photo wins ties. */
function pickHero(selected: PhotoAsset[]): PhotoAsset | undefined {
  if (selected.length === 0) return undefined;
  return selected.reduce((winner, photo) => {
    const bonus = photo.orientation === "landscape" ? 0.08 : 0;
    const winnerBonus = winner.orientation === "landscape" ? 0.08 : 0;
    return photo.qualityScore + bonus > winner.qualityScore + winnerBonus
      ? photo
      : winner;
  });
}

/* ---------------------------------- geometry --------------------------------- */

export function daysBetween(a: PhotoAsset, b: PhotoAsset): number {
  if (a.capturedAt === null || b.capturedAt === null) return 0;
  return Math.abs(b.capturedAt - a.capturedAt) / 86_400_000;
}

export function kmBetween(
  a: Pick<PhotoAsset, "lat" | "lng">,
  b: Pick<PhotoAsset, "lat" | "lng">,
): number {
  if (
    a.lat === undefined ||
    a.lng === undefined ||
    b.lat === undefined ||
    b.lng === undefined
  ) {
    return 0;
  }

  const R = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

function toRad(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

export function formatDateLabel(
  startAt: number | null,
  endAt: number | null,
): string {
  if (startAt === null) return "";
  const startYear = new Date(startAt).getFullYear();
  const endYear = endAt !== null ? new Date(endAt).getFullYear() : startYear;
  return startYear === endYear ? `${startYear}` : `${startYear}–${endYear}`;
}
