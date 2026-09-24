// The lite bundle, not the bare "exifr" specifier — see
// src/types/exifr-lite.d.ts for why.
import exifr from "exifr/dist/lite.esm.js";

export type ExifFacts = {
  capturedAt: number | null;
  lat?: number;
  lng?: number;
};

/**
 * Reads metadata only — never a full decode. exifr throws on formats without
 * readable EXIF, which is expected and non-fatal.
 */
export async function readExif(file: File): Promise<ExifFacts> {
  try {
    const parsed = await exifr.parse(file, {
      tiff: true,
      exif: true,
      gps: true,
    });
    if (!parsed) return { capturedAt: null };

    const captured =
      toTime(parsed.DateTimeOriginal) ??
      toTime(parsed.CreateDate) ??
      toTime(parsed.DateTimeDigitized) ??
      toTime(parsed.ModifyDate);

    const lat = finiteOrUndefined(parsed.latitude);
    const lng = finiteOrUndefined(parsed.longitude);

    return { capturedAt: captured, lat, lng };
  } catch {
    return { capturedAt: null };
  }
}

function toTime(value: unknown): number | null {
  if (value instanceof Date) {
    const time = value.getTime();
    return Number.isFinite(time) ? time : null;
  }
  if (typeof value === "string") {
    const time = Date.parse(value);
    return Number.isFinite(time) ? time : null;
  }
  return null;
}

function finiteOrUndefined(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}
