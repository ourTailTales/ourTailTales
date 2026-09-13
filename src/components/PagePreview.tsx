"use client";

import { FIXED_SLOTS, LAYOUTS, PAGE_INCHES, TRIM_INCHES } from "@/lib/book/layouts";
import { CLOSING_LINE, possessivePetName } from "@/lib/book/pagination";
import { useOurTailTalesStore } from "@/store/useOurTailTalesStore";
import type { BookMeta, BookPage, Chapter } from "@/types/book";
import type { PhotoAsset } from "@/types/photo";
import type { VideoAsset, VideoMemoryPlacement } from "@/types/video-memory";

const TRIM_INSET_PERCENT = ((PAGE_INCHES - TRIM_INCHES) / 2 / PAGE_INCHES) * 100;

export function PagePreview({
  page,
  chapter,
  meta,
  photos,
  showTrimGuide = false,
  placements,
  videoAssets,
}: {
  page: BookPage;
  chapter?: Chapter;
  meta: BookMeta;
  photos: Map<string, PhotoAsset>;
  showTrimGuide?: boolean;
  placements?: VideoMemoryPlacement[];
  videoAssets?: VideoAsset[];
}) {
  const storePlacements = useOurTailTalesStore((state) => state.placements);
  const storeAssets = useOurTailTalesStore((state) => state.videoAssets);
  const pagePlacements = (placements ?? storePlacements).filter(
    (placement) => placement.pageId === page.id,
  );
  const assets = videoAssets ?? storeAssets;

  return (
    /* Container query units keep page typography proportional at any preview size. */
    <div className="@container relative aspect-square w-full overflow-hidden bg-white">
      {renderBody({ page, chapter, meta, photos })}
      {pagePlacements.map((placement) => (
        <VideoMemoryPlaceholder
          key={placement.id}
          placement={placement}
          asset={assets.find((entry) => entry.id === placement.videoAssetId)}
        />
      ))}

      {showTrimGuide && (
        <div
          aria-hidden
          className="pointer-events-none absolute border border-dashed border-periwinkle/25"
          style={{
            inset: `${TRIM_INSET_PERCENT}%`,
          }}
        />
      )}
    </div>
  );
}

function renderBody({
  page,
  chapter,
  meta,
  photos,
}: {
  page: BookPage;
  chapter?: Chapter;
  meta: BookMeta;
  photos: Map<string, PhotoAsset>;
}) {
  switch (page.kind) {
    case "title":
      return <TitlePage meta={meta} photo={photos.get(page.photoIds[0] ?? "")} />;
    case "dedication":
      return <DedicationPage meta={meta} />;
    case "chapter-opener":
      return (
        <OpenerPage
          chapter={chapter}
          photo={photos.get(page.photoIds[0] ?? "")}
        />
      );
    case "closing":
      return <ClosingPage photo={photos.get(page.photoIds[0] ?? "")} />;
    case "imprint":
      return <ImprintPage meta={meta} />;
    case "photos":
    default:
      return <PhotoPage page={page} photos={photos} />;
  }
}

function TitlePage({
  meta,
  photo,
}: {
  meta: BookMeta;
  photo?: PhotoAsset;
}) {
  return (
    <div className="relative h-full w-full">
      <div className="absolute inset-x-[12%] top-[22%] text-center">
        <p className="font-display text-[7cqw] leading-tight text-ink">
          {meta.petName || "Their name"}
        </p>
        {lifespan(meta) && (
          <p className="mt-[4%] text-[3cqw] tracking-[0.2em] text-ink-faint uppercase">
            {lifespan(meta)}
          </p>
        )}
      </div>

      {photo && (
        <div className="absolute overflow-hidden" style={percentStyle(FIXED_SLOTS.titleHero)}>
          <Thumb photo={photo} />
        </div>
      )}

      <p className="absolute inset-x-0 bottom-[8%] text-center text-[2.4cqw] tracking-[0.28em] text-ink-faint uppercase">
        ourTailTales
      </p>
    </div>
  );
}

function DedicationPage({ meta }: { meta: BookMeta }) {
  if (!meta.dedication.trim()) {
    return (
      <div className="flex h-full items-center justify-center">
        <span
          aria-hidden
          className="h-px w-[18%] bg-line"
        />
      </div>
    );
  }

  return (
    <div className="flex h-full items-center justify-center px-[16%]">
      <p className="font-display text-[4cqw] leading-relaxed text-ink italic text-center">
        {meta.dedication}
      </p>
    </div>
  );
}

function OpenerPage({
  chapter,
  photo,
}: {
  chapter?: Chapter;
  photo?: PhotoAsset;
}) {
  const layout = LAYOUTS["chapter-opener"];
  const slot = layout.slots[0];
  const text = layout.textBox!;

  return (
    <div className="relative h-full w-full">
      <div
        className="absolute overflow-hidden"
        style={percentStyle(slot)}
      >
        {photo ? <Thumb photo={photo} /> : <BlankSlot />}
      </div>

      <div
        className="absolute flex flex-col justify-center rounded-sm bg-lavender/50 px-[3%] py-[2%]"
        style={percentStyle(text)}
      >
        <p className="text-[2.4cqw] tracking-[0.24em] text-periwinkle uppercase">
          {chapter?.dateLabel || ""}
        </p>
        <h3 className="mt-[2%] font-display text-[6cqw] leading-tight text-ink">
          {chapter?.title || ""}
        </h3>
        <p className="mt-[3%] line-clamp-5 text-[2.5cqw] leading-relaxed text-ink-soft">
          {chapter?.blurb || ""}
        </p>
      </div>
    </div>
  );
}

function ClosingPage({ photo }: { photo?: PhotoAsset }) {
  return (
    <div className="relative h-full w-full">
      <div
        className="absolute overflow-hidden"
        style={percentStyle(FIXED_SLOTS.closingHero)}
      >
        {photo ? <Thumb photo={photo} /> : <BlankSlot />}
      </div>
      <div className="absolute inset-x-0 bottom-0 flex h-[22%] items-center justify-center">
        <p className="font-display text-[3.4cqw] text-ink">{CLOSING_LINE}</p>
      </div>
    </div>
  );
}

function ImprintPage({ meta }: { meta: BookMeta }) {
  return (
    <div className="flex h-full flex-col items-center justify-end gap-[3%] px-[14%] pb-[16%] text-center">
      <p className="text-[2.6cqw] tracking-[0.28em] text-ink-faint uppercase">
        ourTailTales
      </p>
      <p className="text-[2.2cqw] leading-relaxed text-ink-faint">
        Made from {possessivePetName(meta.petName)} own photographs.
        <br />
        Printed and bound on demand.
      </p>
    </div>
  );
}

function PhotoPage({
  page,
  photos,
}: {
  page: BookPage;
  photos: Map<string, PhotoAsset>;
}) {
  if (!page.layoutId || page.photoIds.length === 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <span aria-hidden className="h-px w-[18%] bg-line" />
      </div>
    );
  }

  const layout = LAYOUTS[page.layoutId];

  return (
    <div className="relative h-full w-full">
      {page.photoIds.map((photoId, index) => {
        const slot = layout.slots[index];
        if (!slot) return null;
        const photo = photos.get(photoId);
        return (
          <div
            key={photoId}
            className="absolute overflow-hidden"
            style={percentStyle(slot)}
          >
            {photo ? <Thumb photo={photo} /> : <BlankSlot />}
          </div>
        );
      })}
    </div>
  );
}

function VideoMemoryPlaceholder({
  placement,
  asset,
}: {
  placement: VideoMemoryPlacement;
  asset?: VideoAsset;
}) {
  return (
    <div
      className="pointer-events-none absolute flex flex-col justify-end overflow-hidden rounded-[2%] bg-memory-blue"
      style={percentStyle({
        x: placement.x,
        y: placement.y,
        w: placement.width,
        h: placement.height,
      })}
    >
      {asset?.previewUrl ? (
        /* eslint-disable-next-line @next/next/no-img-element -- signed preview, not a remote CMS asset */
        <img
          src={asset.previewUrl}
          alt=""
          className="absolute inset-0 h-full w-full object-cover opacity-70"
        />
      ) : (
        <div
          aria-hidden
          className="absolute inset-[12%] rounded-[4%] border border-ink/25 bg-white/70"
        />
      )}
      <p className="relative px-[6%] py-[7%] text-center text-[7cqw] font-medium leading-tight text-ink">
        Watch this memory
      </p>
    </div>
  );
}

function Thumb({ photo }: { photo: PhotoAsset }) {
  return (
    /* eslint-disable-next-line @next/next/no-img-element -- local object URL, not a remote asset */
    <img
      src={photo.thumbUrl}
      alt=""
      loading="lazy"
      decoding="async"
      className="h-full w-full object-cover"
    />
  );
}

function BlankSlot() {
  return <div className="h-full w-full bg-memory-blue/50" />;
}

function percentStyle(slot: { x: number; y: number; w: number; h: number }) {
  return {
    left: `${slot.x * 100}%`,
    top: `${slot.y * 100}%`,
    width: `${slot.w * 100}%`,
    height: `${slot.h * 100}%`,
  };
}

export function lifespan(meta: BookMeta): string {
  if (meta.birthYear && meta.deathYear) return `${meta.birthYear} – ${meta.deathYear}`;
  return meta.birthYear || meta.deathYear || "";
}
