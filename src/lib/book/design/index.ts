import type { BookDesign } from "@/lib/book/design/common";
import { classic } from "@/lib/book/design/designs/classic";
import { modern } from "@/lib/book/design/designs/modern";
import { scrapbook } from "@/lib/book/design/designs/scrapbook";
import { vintage } from "@/lib/book/design/designs/vintage";
import { photoCaption, type DesignContext, type PageDesign } from "@/lib/book/design/primitives";
import { resolvePalette } from "@/lib/book/palette";
import type { BookMeta, BookPage, Chapter, DesignId } from "@/types/book";
import type { PhotoAsset } from "@/types/photo";

export type { BookDesign } from "@/lib/book/design/common";

/**
 * Every design the book can be printed in, in the order the picker shows them.
 *
 * Adding one is a matter of writing a `BookDesign` and listing it here: the
 * renderers, the editor and the layout picker all read this list.
 */
export const DESIGNS: readonly BookDesign[] = [scrapbook, classic, modern, vintage];

export const DEFAULT_DESIGN_ID: DesignId = "scrapbook";

/**
 * The design every free preview is printed in, whatever the book is set to.
 * The teaser is the first thing anyone sees of their book; it is always the
 * scrapbook, and the other designs are something an account unlocks.
 */
export const TEASER_DESIGN_ID: DesignId = "scrapbook";

const BY_ID = new Map(DESIGNS.map((design) => [design.id, design]));

export function isDesignId(value: unknown): value is DesignId {
  return typeof value === "string" && BY_ID.has(value as DesignId);
}

/** The design a book is set in — Scrapbook when unset or unknown. */
export function resolveDesign(meta: Pick<BookMeta, "designId">): BookDesign {
  return BY_ID.get(meta.designId ?? DEFAULT_DESIGN_ID) ?? scrapbook;
}

/** The same book, set in another design. */
export function withDesign<T extends BookMeta>(meta: T, designId: DesignId): T {
  return meta.designId === designId ? meta : { ...meta, designId };
}

/** Everything a design needs from the book to draw its pages. */
export function designContext(args: {
  meta: BookMeta;
  chapter: Chapter | undefined;
  photos: Map<string, PhotoAsset>;
}): DesignContext {
  const { meta, chapter, photos } = args;
  return {
    meta,
    chapter,
    palette: resolvePalette(meta),
    orientationOf: (id) => photos.get(id)?.orientation,
    captionOf: (id) => photoCaption(photos.get(id)?.capturedAt),
  };
}

/** One page, drawn in the book's design. */
export function designPage(page: BookPage, context: DesignContext): PageDesign {
  return resolveDesign(context.meta).designPage(page, context);
}
