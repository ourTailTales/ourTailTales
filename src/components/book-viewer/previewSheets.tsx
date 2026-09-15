"use client";

import type { ReactNode } from "react";

import { PagePreview } from "@/components/PagePreview";
import { pairInteriorLeaves, type PreviewPairing } from "@/lib/book/preview-model";
import type { BookMeta, BookPage, Chapter } from "@/types/book";
import type { PhotoAsset } from "@/types/photo";

import {
  BackCoverArt,
  CoverFrontArt,
  CoverInsideArt,
  coverImageUrl,
} from "./CoverArt";
import type { FlipSheet } from "./types";

export function EndpaperFace({
  children,
}: {
  children?: ReactNode;
}) {
  return (
    <div className="flex h-full w-full items-center justify-center bg-[#f3eee4]">
      {children ?? (
        <span className="sr-only">This leaf is blank so the book closes evenly.</span>
      )}
    </div>
  );
}

function bleedFace(content: ReactNode): ReactNode {
  return (
    <div data-bv-bleed className="h-full w-full overflow-hidden bg-white">
      {content}
    </div>
  );
}

function pageFace(
  page: BookPage,
  chapters: Chapter[],
  meta: BookMeta,
  photos: Map<string, PhotoAsset>,
): ReactNode {
  return bleedFace(
    <PagePreview
      page={page}
      chapter={chapters.find((entry) => entry.id === page.chapterId)}
      meta={meta}
      photos={photos}
      showTrimGuide={false}
    />,
  );
}

/** Customer cover + every generated interior page + back board. */
export function buildCustomerBookSheets({
  pages,
  chapters,
  meta,
  photos,
  pairing = "spread",
}: {
  pages: BookPage[];
  chapters: Chapter[];
  meta: BookMeta;
  photos: Map<string, PhotoAsset>;
  pairing?: PreviewPairing;
}): FlipSheet[] {
  const coverPhotoId = meta.coverPhotoId ?? chapters[0]?.heroPhotoId ?? null;

  const sheets: FlipSheet[] = [
    {
      id: "cover",
      kind: "hard",
      front: (
        <CoverFrontArt
          meta={meta}
          photoUrl={coverImageUrl(photos.values(), coverPhotoId)}
        />
      ),
      back: <CoverInsideArt />,
    },
  ];

  for (const leaf of pairInteriorLeaves(pages.length, pairing)) {
    const frontPage = pages[leaf.front];
    if (!frontPage) continue;
    const backPage = leaf.back != null ? pages[leaf.back] : undefined;
    sheets.push({
      id: `story-${frontPage.id}`,
      kind: "soft",
      front: pageFace(frontPage, chapters, meta, photos),
      back: backPage
        ? pageFace(backPage, chapters, meta, photos)
        : (
            <EndpaperFace />
          ),
    });
  }

  sheets.push({
    id: "back-cover",
    kind: "hard",
    front: <BackCoverArt dedication={meta.dedication} />,
    back: <div className="h-full w-full bg-memory-blue" />,
  });

  return sheets;
}

export function nearbyPreviewImageUrls({
  pages,
  photos,
  indexes,
}: {
  pages: BookPage[];
  photos: Map<string, PhotoAsset>;
  indexes: number[];
}): string[] {
  const urls = new Set<string>();
  for (const index of indexes) {
    const page = pages[index];
    if (!page) continue;
    for (const photoId of page.photoIds) {
      const url = photos.get(photoId)?.thumbUrl;
      if (url) urls.add(url);
    }
  }
  return [...urls];
}
