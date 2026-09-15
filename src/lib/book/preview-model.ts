export type PreviewPairing = "spread" | "single";

export type InteriorLeaf = {
  front: number;
  back: number | null;
};

/** Pair interior pages into physical leaves (or one page per leaf on narrow screens). */
export function pairInteriorLeaves(
  pageCount: number,
  pairing: PreviewPairing,
): InteriorLeaf[] {
  if (pageCount <= 0) return [];
  if (pairing === "single") {
    return Array.from({ length: pageCount }, (_, index) => ({
      front: index,
      back: null,
    }));
  }

  const leaves: InteriorLeaf[] = [];
  for (let index = 0; index < pageCount; index += 2) {
    leaves.push({
      front: index,
      back: index + 1 < pageCount ? index + 1 : null,
    });
  }
  return leaves;
}

/**
 * Highest `currentPage` that still shows a real spread or leaf.
 * Stops before the reverse of the back board.
 */
export function lastReadablePage(faceCount: number): number {
  return Math.max(0, faceCount - 3);
}

export function currentPageForFocus(
  focus: number,
  pairing: PreviewPairing,
): number {
  if (focus <= 0) return 0;
  if (pairing === "single") return 1 + (focus - 1) * 2;
  if (focus === 1) return 1;
  return focus % 2 === 0 ? focus + 1 : focus;
}

export function focusFromCurrentPage(
  currentPage: number,
  pairing: PreviewPairing,
  closed: boolean,
): number {
  if (closed || currentPage <= 0) return 0;
  if (pairing === "single") return (currentPage - 1) / 2 + 1;
  if (currentPage === 1) return 1;
  return currentPage - 1;
}

type FaceRole = "Cover" | "Inside cover" | "Back cover" | number;

function faceRole(
  faceIndex: number,
  interiorCount: number,
  pairing: PreviewPairing = "spread",
): FaceRole | null {
  if (faceIndex < 0) return null;
  if (faceIndex === 0) return "Cover";
  if (faceIndex === 1) return "Inside cover";
  if (pairing === "single") {
    if (faceIndex % 2 !== 0) return null;
    const page = faceIndex / 2;
    if (page <= interiorCount) return page;
    if (page === interiorCount + 1) return "Back cover";
    return null;
  }
  const page = faceIndex - 1;
  if (page <= interiorCount) return page;
  if (page === interiorCount + 1) return "Back cover";
  return null;
}

function formatRole(role: FaceRole, interiorCount: number): string {
  if (role === "Cover" || role === "Inside cover" || role === "Back cover") {
    return role;
  }
  return interiorCount > 0 ? `${role}` : String(role);
}

/** Human label for the current cover, leaf, or two-page spread. */
export function previewSpreadLabel({
  currentPage,
  interiorCount,
  pairing,
  closed,
}: {
  currentPage: number;
  interiorCount: number;
  pairing: PreviewPairing;
  closed: boolean;
}): string {
  if (closed || currentPage <= 0) return "Cover";

  if (pairing === "single") {
    const right = faceRole(currentPage + 1, interiorCount, pairing);
    if (typeof right === "number") {
      return interiorCount > 0
        ? `Page ${right} of ${interiorCount}`
        : `Page ${right}`;
    }
    if (right === "Back cover") return "Back cover";
    const left = faceRole(currentPage, interiorCount, pairing);
    return left ? formatRole(left, interiorCount) : "Cover";
  }

  const left = faceRole(currentPage, interiorCount, pairing);
  const right = faceRole(currentPage + 1, interiorCount, pairing);
  if (left && right) {
    return `${formatRole(left, interiorCount)} · ${formatRole(right, interiorCount)}`;
  }
  if (left) return formatRole(left, interiorCount);
  if (right) return formatRole(right, interiorCount);
  return "Cover";
}

export function nearbyInteriorIndexes(
  currentPage: number,
  interiorCount: number,
  pairing: PreviewPairing,
  radius = 2,
): number[] {
  if (interiorCount <= 0) return [];
  const focus = Math.max(
    1,
    Math.round(focusFromCurrentPage(currentPage, pairing, currentPage <= 0)),
  );
  const start = Math.max(1, focus - radius);
  const end = Math.min(interiorCount, focus + radius);
  const indexes: number[] = [];
  for (let page = start; page <= end; page += 1) {
    indexes.push(page - 1);
  }
  return indexes;
}
