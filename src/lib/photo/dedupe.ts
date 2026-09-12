import type { PhotoAsset } from "@/types/photo";

/** Bits of dHash difference still considered the same picture. */
const NEAR_DUPLICATE_BITS = 6;

/**
 * Camera-roll near-duplicates are burst shots, so comparing every pair is
 * wasteful. Only photos close together in the chronology are compared.
 */
const WINDOW = 40;

export function hammingHex(a: string, b: string): number {
  if (a.length !== b.length) return Number.MAX_SAFE_INTEGER;
  let distance = 0;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] === b[i]) continue;
    distance += POPCOUNT_16[(parseInt(a[i], 16) ^ parseInt(b[i], 16)) & 0xf];
  }
  return distance;
}

const POPCOUNT_16 = [0, 1, 1, 2, 1, 2, 2, 3, 1, 2, 2, 3, 2, 3, 3, 4];

/**
 * Assigns `duplicateGroupId` and flags all but the best member of each group
 * as `isDuplicate`. Duplicates are hidden from selection but never deleted, so
 * the customer can restore them.
 *
 * Returns a new array; input order is preserved.
 */
export function groupDuplicates(photos: PhotoAsset[]): PhotoAsset[] {
  const next = photos.map((photo) => ({
    ...photo,
    duplicateGroupId: undefined as string | undefined,
    isDuplicate: false,
  }));

  const byId = new Map(next.map((photo) => [photo.id, photo]));
  const parent = new Map<string, string>();
  for (const photo of next) parent.set(photo.id, photo.id);

  const find = (id: string): string => {
    let root = id;
    while (parent.get(root) !== root) root = parent.get(root)!;
    let cursor = id;
    while (parent.get(cursor) !== cursor) {
      const nextCursor = parent.get(cursor)!;
      parent.set(cursor, root);
      cursor = nextCursor;
    }
    return root;
  };

  const union = (a: string, b: string): void => {
    const rootA = find(a);
    const rootB = find(b);
    if (rootA !== rootB) parent.set(rootB, rootA);
  };

  // Exact-ish duplicates: identical size + dimensions + capture time.
  const byFingerprint = new Map<string, string>();
  for (const photo of next) {
    const seen = byFingerprint.get(photo.fingerprint);
    if (seen) union(seen, photo.id);
    else byFingerprint.set(photo.fingerprint, photo.id);
  }

  // Near-duplicates within a chronological window.
  const chronological = [...next].sort(compareChronologically);
  for (let i = 0; i < chronological.length; i += 1) {
    const a = chronological[i];
    for (let j = i + 1; j < Math.min(i + 1 + WINDOW, chronological.length); j += 1) {
      const b = chronological[j];
      if (hammingHex(a.dHash, b.dHash) <= NEAR_DUPLICATE_BITS) union(a.id, b.id);
    }
  }

  const groups = new Map<string, string[]>();
  for (const photo of next) {
    const root = find(photo.id);
    const members = groups.get(root);
    if (members) members.push(photo.id);
    else groups.set(root, [photo.id]);
  }

  for (const [root, memberIds] of groups) {
    if (memberIds.length < 2) continue;
    const best = memberIds.reduce((winner, id) => {
      const candidate = byId.get(id)!;
      const current = byId.get(winner)!;
      return candidate.qualityScore > current.qualityScore ? id : winner;
    }, memberIds[0]);

    for (const id of memberIds) {
      const photo = byId.get(id)!;
      photo.duplicateGroupId = root;
      photo.isDuplicate = id !== best;
    }
  }

  return next;
}

export function compareChronologically(a: PhotoAsset, b: PhotoAsset): number {
  if (a.capturedAt !== null && b.capturedAt !== null) {
    if (a.capturedAt !== b.capturedAt) return a.capturedAt - b.capturedAt;
    return a.fileName.localeCompare(b.fileName, undefined, { numeric: true });
  }
  if (a.capturedAt === null && b.capturedAt !== null) return 1;
  if (a.capturedAt !== null && b.capturedAt === null) return -1;
  return a.fileName.localeCompare(b.fileName, undefined, { numeric: true });
}

/** Photos eligible for placement: usable and not a hidden duplicate. */
export function selectablePhotos(photos: PhotoAsset[]): PhotoAsset[] {
  return photos.filter((photo) => photo.usable && !photo.isDuplicate);
}
