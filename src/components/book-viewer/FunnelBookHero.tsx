"use client";

import { useMemo, type ReactNode } from "react";

import { BookViewer } from "@/components/book-viewer/BookViewer";
import {
  BackCoverArt,
  CoverFrontArt,
  CoverInsideArt,
  coverImageUrl,
} from "@/components/book-viewer/CoverArt";
import { EndpaperFace } from "@/components/book-viewer/previewSheets";
import type { FlipSheet } from "@/components/book-viewer/types";
import { PagePreview } from "@/components/PagePreview";
import { selectablePhotos } from "@/lib/photo/dedupe";
import {
  photoMapOf,
  useOurTailTalesStore,
} from "@/store/useOurTailTalesStore";
import type { BookMeta, BookPage } from "@/types/book";
import type { PhotoAsset } from "@/types/photo";

export type FunnelBookMode = "closed" | "meta";

function bleedFace(content: ReactNode) {
  return (
    <div data-bv-bleed className="h-full w-full overflow-hidden bg-white">
      {content}
    </div>
  );
}

function metaInteriorPage(
  page: BookPage,
  meta: BookMeta,
  photos: Map<string, PhotoAsset>,
) {
  return bleedFace(
    <PagePreview page={page} meta={meta} photos={photos} showTrimGuide={false} />,
  );
}

function titleHeroPhotoId(
  meta: BookMeta,
  photos: PhotoAsset[],
  photoMap: Map<string, PhotoAsset>,
): string | null {
  if (meta.coverPhotoId && photoMap.has(meta.coverPhotoId)) {
    return meta.coverPhotoId;
  }
  return selectablePhotos(photos)[0]?.id ?? null;
}

function closedSheets(
  meta: BookMeta,
  photoMap: Map<string, PhotoAsset>,
  coverPhotoId: string | null,
): FlipSheet[] {
  return [
    {
      id: "cover",
      kind: "hard",
      front: (
        <CoverFrontArt
          meta={meta}
          photoUrl={coverImageUrl(photoMap.values(), coverPhotoId)}
        />
      ),
      back: <div className="h-full w-full bg-[#e4ddd0]" />,
    },
    {
      id: "back-cover",
      kind: "hard",
      front: <BackCoverArt dedication={meta.dedication} />,
      back: <div className="h-full w-full bg-memory-blue" />,
    },
  ];
}

function metaSheets(
  meta: BookMeta,
  photos: PhotoAsset[],
  photoMap: Map<string, PhotoAsset>,
  coverPhotoId: string | null,
): FlipSheet[] {
  const titlePhotoId = titleHeroPhotoId(meta, photos, photoMap);
  const titlePage: BookPage = {
    id: "funnel-title",
    kind: "title",
    pageNumber: 1,
    layoutId: null,
    photoIds: titlePhotoId ? [titlePhotoId] : [],
  };
  const dedicationPage: BookPage = {
    id: "funnel-dedication",
    kind: "dedication",
    pageNumber: 2,
    layoutId: null,
    photoIds: [],
  };

  return [
    {
      id: "cover",
      kind: "hard",
      front: (
        <CoverFrontArt
          meta={meta}
          photoUrl={coverImageUrl(photoMap.values(), coverPhotoId)}
        />
      ),
      back: <CoverInsideArt />,
    },
    {
      id: "title",
      kind: "soft",
      front: metaInteriorPage(titlePage, meta, photoMap),
      back: <EndpaperFace />,
    },
    {
      id: "dedication",
      kind: "soft",
      front: metaInteriorPage(dedicationPage, meta, photoMap),
      back: <EndpaperFace />,
    },
    {
      id: "back-cover",
      kind: "hard",
      front: <BackCoverArt dedication={meta.dedication} />,
      back: <div className="h-full w-full bg-memory-blue" />,
    },
  ];
}

/** Companion hardcover — closed cover, or open title/dedication on the meta step. */
export function FunnelBookHero({
  docked = false,
  mode = "closed",
}: {
  docked?: boolean;
  mode?: FunnelBookMode;
}) {
  const meta = useOurTailTalesStore((state) => state.meta);
  const photos = useOurTailTalesStore((state) => state.photos);
  const chapters = useOurTailTalesStore((state) => state.chapters);
  const photoMap = useMemo(() => photoMapOf(photos), [photos]);
  const coverPhotoId = meta.coverPhotoId ?? chapters[0]?.heroPhotoId ?? null;
  const open = mode === "meta";

  const sheets = useMemo(
    (): FlipSheet[] =>
      open
        ? metaSheets(meta, photos, photoMap, coverPhotoId)
        : closedSheets(meta, photoMap, coverPhotoId),
    [coverPhotoId, meta, open, photoMap, photos],
  );

  return (
    <div
      className={
        docked
          ? open
            ? "landing-hero-book landing-hero-book--docked landing-hero-book--open"
            : "landing-hero-book landing-hero-book--docked"
          : "landing-hero-book"
      }
    >
      <BookViewer
        key={mode}
        sheets={sheets}
        coverOpen={open}
        initialPage={open ? 1 : 0}
        hideNav
        compact
        docked={docked}
        lockCover
        keyboard="none"
        clickToTurn={false}
        preferSingleFirstLeaf
      />
    </div>
  );
}
