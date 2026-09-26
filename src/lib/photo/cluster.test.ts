import { describe, expect, it } from "vitest";

import {
  SEAM_DAYS,
  albumChapterRange,
  chaptersForAlbum,
  proposeChapters,
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
