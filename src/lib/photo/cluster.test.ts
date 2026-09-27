import { describe, expect, it } from "vitest";

import {
  SEAM_DAYS,
  albumChapterRange,
  chaptersForAlbum,
  proposeChapters,
  selectRepresentatives,
} from "@/lib/photo/cluster";
import {
  BASE_CHAPTERS,
  DEFAULT_CHAPTER_CAP,
  MAX_CHAPTERS,
  MIN_PHOTOS_PER_CHAPTER,
  maxSupportedChapters,
} from "@/lib/pricing";
import type { PhotoAsset } from "@/types/photo";

const DAY = 86_400_000;
const START = Date.UTC(2017, 0, 1);

let serial = 0;
function photoAt(capturedAt: number | null): PhotoAsset {
  serial += 1;
  return {
    id: `photo-${serial}`,
    fileName: `${serial}.jpg`,
    fileSize: 2_000_000,
    capturedAt,
    dateSource: capturedAt === null ? "unknown" : "exif",
    width: 4032,
    height: 3024,
    orientation: "landscape",
    qualityScore: 0.7,
    dHash: serial.toString(16).padStart(16, "0"),
    fingerprint: `f-${serial}`,
    isDuplicate: false,
    usable: true,
    thumbUrl: "",
  };
}

/**
 * An album the way a camera roll actually looks: a run of pictures from one
 * occasion, then months of nothing, then the next.
 */
function albumOf(runs: number[], apartDays = 90): PhotoAsset[] {
  const photos: PhotoAsset[] = [];
  let day = 0;
  for (const size of runs) {
    for (let i = 0; i < size; i += 1) {
      photos.push(photoAt(START + (day + i) * DAY));
    }
    day += size + apartDays;
  }
  return photos;
}

describe("how many chapters an album comes to", () => {
  it("follows the album's own periods rather than a fixed five", () => {
    // Twelve outings, months apart, a hundred photographs between them: the
    // book this album is, not five chapters of twenty.
    const album = albumOf(Array.from({ length: 12 }, () => 8));
    expect(album).toHaveLength(96);
    expect(chaptersForAlbum(album)).toBe(12);
  });

  it("proposes no more than the default cap, and says what is there", () => {
    // Thirty outings: thirty periods the album really has, but a book is not
    // quoted at thirty chapters unless somebody asks for it.
    const album = albumOf(Array.from({ length: 30 }, () => 8));
    const range = albumChapterRange(album);

    expect(range.available).toBe(30);
    expect(range.recommended).toBe(DEFAULT_CHAPTER_CAP);
    expect(range.least).toBe(BASE_CHAPTERS);
    expect(chaptersForAlbum(album)).toBe(DEFAULT_CHAPTER_CAP);
  });

  it("proposes everything when the album is under the cap", () => {
    const album = albumOf(Array.from({ length: 8 }, () => 8));
    const range = albumChapterRange(album);
    expect(range.available).toBe(8);
    expect(range.recommended).toBe(8);
  });

  it("never offers more than the printer binds", () => {
    // Four hundred outings is four hundred periods; fifty is the cap, and
    // three thousand two hundred photographs can fill it.
    const album = albumOf(Array.from({ length: 400 }, () => 8));
    expect(albumChapterRange(album).available).toBe(MAX_CHAPTERS);
  });

  it("never goes below the base book", () => {
    // One long summer, photographed daily: one period, but the smallest book
    // this shop sells is five chapters.
    const album = albumOf([60]);
    expect(chaptersForAlbum(album)).toBe(BASE_CHAPTERS);
  });

  it("gathers brief outings into chapters rather than one long one", () => {
    // Thirty visits of two photographs. Neither thirty chapters of two nor
    // one chapter of sixty: runs are gathered until there are enough for a
    // chapter, which is ten chapters of six.
    const album = albumOf(Array.from({ length: 30 }, () => 2));
    const count = albumChapterRange(album).available;
    expect(count).toBe(10);
    expect(count).toBeLessThanOrEqual(maxSupportedChapters(album.length));
    expect(count).toBeLessThanOrEqual(MAX_CHAPTERS);
    expect(album.length / count).toBeGreaterThanOrEqual(MIN_PHOTOS_PER_CHAPTER);
  });

  it("never offers more chapters than the photographs can fill", () => {
    // A hundred outings of one photograph: a hundred periods, a hundred
    // photographs, and at five to a chapter twenty is all they fill.
    const album = albumOf(Array.from({ length: 100 }, () => 1));
    expect(albumChapterRange(album).available).toBe(
      maxSupportedChapters(album.length),
    );
  });

  it("does not make a chapter out of one stray afternoon", () => {
    // Two real periods with a single picture stranded between them.
    const album = albumOf([20, 1, 20]);
    // Five, the floor — not six, which is what counting every run would give.
    expect(chaptersForAlbum(album)).toBe(BASE_CHAPTERS);
  });

  it("keeps a run together when the gap is shorter than a seam", () => {
    const withinOneOuting = albumOf(Array.from({ length: 12 }, () => 8), SEAM_DAYS - 3);
    const separateOutings = albumOf(Array.from({ length: 12 }, () => 8), SEAM_DAYS + 3);
    expect(chaptersForAlbum(withinOneOuting)).toBe(BASE_CHAPTERS);
    expect(chaptersForAlbum(separateOutings)).toBe(12);
  });

  it("falls back to the base book when nothing has a date", () => {
    const undated = Array.from({ length: 60 }, () => photoAt(null));
    expect(chaptersForAlbum(undated)).toBe(BASE_CHAPTERS);
  });

  it("has an answer for an empty album", () => {
    expect(chaptersForAlbum([])).toBe(BASE_CHAPTERS);
  });
});

describe("a week away", () => {
  /** An album with somewhere to be: `[count, dayOffset, kmFromHome]`. */
  function trip(legs: [number, number, number][]): PhotoAsset[] {
    return legs.flatMap(([count, day, km]) =>
      Array.from({ length: count }, (_, index) => ({
        ...photoAt(START + (day + index) * DAY),
        lat: 47.6,
        // A degree of longitude at this latitude is almost exactly 75 km.
        lng: -122.3 + km / 75,
      })),
    );
  }

  /** Five ordinary periods months apart, then a fortnight with a week in it. */
  const lastLegAt = (km: number): [number, number, number][] => [
    [10, 0, 0],
    [10, 100, 0],
    [10, 200, 0],
    [10, 300, 0],
    [10, 400, 0],
    [5, 500, 0],
    [5, 510, km],
  ];

  it("is its own period even with no quiet fortnight around it", () => {
    // Ten days at home and then five hundred miles away, photographed
    // throughout: no gap anywhere in it is long enough to be a seam on the
    // calendar, and it is plainly not the same stretch of their life.
    expect(albumChapterRange(trip(lastLegAt(900))).available).toBe(7);
  });

  it("is not read into a walk to the next park", () => {
    // The same album with the trip five kilometres from home: one period,
    // as the calendar already said.
    expect(albumChapterRange(trip(lastLegAt(5))).available).toBe(6);
  });
});

describe("which photographs a chapter keeps", () => {
  /** `[count, dayOffset]`, all at home, an hour apart within the day. */
  function occasions(runs: [number, number][]): PhotoAsset[] {
    return runs.flatMap(([count, day]) =>
      Array.from({ length: count }, (_, index) =>
        photoAt(START + day * DAY + index * 3_600_000),
      ),
    );
  }

  it("keeps something from every outing, not just the busy ones", () => {
    // One heavily photographed weekend and eight quiet visits. Slicing the
    // chapter's span evenly gives the weekend a single slice and can leave a
    // whole visit out; every visit has to reach the book.
    const album = occasions([
      [120, 0],
      ...Array.from({ length: 8 }, (_, index): [number, number] => [3, 20 + index * 10]),
    ]);
    const kept = new Set(selectRepresentatives(album, 30).map((photo) => photo.id));

    for (let index = 0; index < 8; index += 1) {
      const visit = album.slice(120 + index * 3, 120 + index * 3 + 3);
      expect(visit.some((photo) => kept.has(photo.id))).toBe(true);
    }
  });

  it("gives the bigger day more of the places", () => {
    const album = occasions([[60, 0], [6, 40]]);
    const kept = new Set(selectRepresentatives(album, 20).map((photo) => photo.id));
    const fromTheBigDay = album.slice(0, 60).filter((photo) => kept.has(photo.id));
    const fromTheSmall = album.slice(60).filter((photo) => kept.has(photo.id));

    expect(kept.size).toBe(20);
    expect(fromTheBigDay.length).toBeGreaterThan(fromTheSmall.length);
    expect(fromTheSmall.length).toBeGreaterThan(0);
  });

  it("keeps a chapter that already fits exactly as it is", () => {
    const album = occasions([[4, 0], [4, 10]]);
    expect(selectRepresentatives(album, 30)).toEqual(album);
  });
});

describe("the chapters that count then produces", () => {
  it("breaks where the album breaks, not at even intervals", () => {
    const album = albumOf(Array.from({ length: 8 }, () => 10));
    const chapters = proposeChapters(album, chaptersForAlbum(album));

    expect(chapters).toHaveLength(8);
    // Every chapter is one outing: ten photographs, all within a few days.
    for (const chapter of chapters) {
      expect(chapter.candidateIds).toHaveLength(10);
      const span = (chapter.endAt ?? 0) - (chapter.startAt ?? 0);
      expect(span / DAY).toBeLessThan(SEAM_DAYS);
    }
  });
});
