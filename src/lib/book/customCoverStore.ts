/**
 * Module-level holder for a customer-uploaded cover file, deliberately
 * outside React and Zustand state — mirrors `lib/photo/assetStore`. Only the
 * metadata (`CustomCoverMeta`) lives in the store; the binary itself (a PNG,
 * JPG, or print-ready PDF) stays here and is read back at checkout time and
 * when restoring a local draft.
 */

let file: File | null = null;
let objectUrl: string | null = null;

export function setCustomCoverFile(nextFile: File): string {
  clearCustomCoverFile();
  file = nextFile;
  objectUrl = URL.createObjectURL(nextFile);
  return objectUrl;
}

export function getCustomCoverFile(): File | null {
  return file;
}

export function getCustomCoverUrl(): string | null {
  return objectUrl;
}

export function clearCustomCoverFile(): void {
  if (objectUrl) URL.revokeObjectURL(objectUrl);
  file = null;
  objectUrl = null;
}
