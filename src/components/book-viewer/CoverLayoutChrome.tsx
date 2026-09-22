"use client";

import { UploadCloud } from "lucide-react";

import type { CoverLayoutId } from "@/types/book";

const DOG_SILHOUETTE_SRC = "/marketing/dog_silhoutte.png";

/**
 * Front-cover background: the photo treatment for a given layout. The
 * ourTailTales mark stays off the front cover — it lives on the back cover's
 * colophon instead, so the customer's own photo and their pet's name are the
 * only things on the front. Name text is drawn on top by the caller
 * (CoverFrontArt for the static/print-facing view, CoverEditor for the live
 * one) so both share one definition of what each layout looks like.
 */
export function CoverLayoutChrome({
  layoutId,
  photoUrl,
  onUploadClick,
}: {
  layoutId: CoverLayoutId;
  photoUrl: string | null;
  /** When set, the no-photo placeholder becomes a clickable "upload photos" CTA instead of static text. */
  onUploadClick?: () => void;
}) {
  if (!photoUrl) {
    const content = (
      <div className="absolute inset-[8%] z-10 flex flex-col items-center justify-center gap-5 rounded-sm border-[2.5px] border-dotted border-[#6f7788]/80 bg-[#c8d0dc]/45 px-6 backdrop-blur-[1px] transition-colors">
        {onUploadClick ? (
          <UploadCloud className="h-9 w-9 text-ink/70" aria-hidden strokeWidth={1.75} />
        ) : (
          <DogSilhouette />
        )}
        <p className="font-sans text-[0.8rem] font-medium tracking-[0.14em] text-ink sm:text-sm">
          {onUploadClick ? "Upload photos to get started" : "start their story"}
        </p>
      </div>
    );

    if (onUploadClick) {
      return (
        <div className="absolute inset-0 overflow-hidden bg-[#c8d0dc]/25">
          <button
            type="button"
            onClick={onUploadClick}
            aria-label="Upload photos"
            className="group absolute inset-0 h-full w-full cursor-pointer transition-colors hover:bg-[#c8d0dc]/35 focus-visible:outline focus-visible:outline-2 focus-visible:outline-periwinkle"
          >
            {content}
          </button>
        </div>
      );
    }

    return <div className="absolute inset-0 overflow-hidden bg-[#c8d0dc]/25">{content}</div>;
  }

  switch (layoutId) {
    case "minimal":
      return (
        <div className="absolute inset-0 overflow-hidden">
          <Photo url={photoUrl} />
          <div
            aria-hidden
            className="absolute inset-0"
            style={{ background: "rgb(37 42 58 / 0.4)" }}
          />
        </div>
      );

    case "editorial":
      return (
        <div className="absolute inset-0 overflow-hidden">
          <Photo url={photoUrl} />
          <div
            aria-hidden
            className="absolute inset-x-0 top-[40%] h-[27%]"
            style={{ background: "rgb(37 42 58 / 0.68)" }}
          />
        </div>
      );

    case "classic":
    default:
      return (
        <div className="absolute inset-0 overflow-hidden">
          <Photo url={photoUrl} />
          <div
            aria-hidden
            className="absolute inset-x-0 bottom-0 h-[36%]"
            style={{
              background:
                "linear-gradient(to top, rgb(37 42 58 / 0.72) 0%, rgb(37 42 58 / 0.42) 42%, rgb(37 42 58 / 0.1) 78%, transparent 100%)",
            }}
          />
        </div>
      );
  }
}

function Photo({ url }: { url: string }) {
  return (
    /* eslint-disable-next-line @next/next/no-img-element -- local object URL */
    <img src={url} alt="" className="absolute inset-0 h-full w-full object-cover" />
  );
}

function DogSilhouette() {
  return (
    <div
      aria-hidden
      className="aspect-square h-[38%] max-h-44 w-auto bg-ink"
      style={{
        WebkitMaskImage: `url(${DOG_SILHOUETTE_SRC})`,
        maskImage: `url(${DOG_SILHOUETTE_SRC})`,
        WebkitMaskRepeat: "no-repeat",
        maskRepeat: "no-repeat",
        WebkitMaskPosition: "center",
        maskPosition: "center",
        WebkitMaskSize: "contain",
        maskSize: "contain",
      }}
    />
  );
}
