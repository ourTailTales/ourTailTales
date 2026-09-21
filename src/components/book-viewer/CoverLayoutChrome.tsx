"use client";

import Image from "next/image";

import { brand } from "@/lib/brand";
import type { CoverLayoutId } from "@/types/book";

const PLACEHOLDER_CAPTION = "start their story";
const DOG_SILHOUETTE_SRC = "/marketing/dog_silhoutte.png";

/**
 * Front-cover background: the photo treatment + logo placement for a given
 * layout. Name/years text is drawn on top by the caller (CoverFrontArt for
 * the static/print-facing view, CoverEditor for the draggable one) so both
 * share one definition of what each layout looks like.
 */
export function CoverLayoutChrome({
  layoutId,
  photoUrl,
}: {
  layoutId: CoverLayoutId;
  photoUrl: string | null;
}) {
  if (!photoUrl) {
    return (
      <div className="absolute inset-0 overflow-hidden bg-[#c8d0dc]/25">
        <div className="absolute inset-[8%] z-10 flex flex-col items-center justify-center gap-5 rounded-sm border-[2.5px] border-dotted border-[#6f7788]/80 bg-[#c8d0dc]/45 px-6 backdrop-blur-[1px]">
          <DogSilhouette />
          <p className="font-sans text-[0.8rem] font-medium tracking-[0.14em] text-ink sm:text-sm">
            {PLACEHOLDER_CAPTION}
          </p>
        </div>
      </div>
    );
  }

  switch (layoutId) {
    case "framed":
      return (
        <div className="absolute inset-0 overflow-hidden bg-[#efe9dd]">
          <div className="absolute inset-[7%] overflow-hidden">
            <Photo url={photoUrl} />
            <div
              aria-hidden
              className="absolute inset-x-0 bottom-0 h-[30%]"
              style={{
                background:
                  "linear-gradient(to top, rgb(37 42 58 / 0.62) 0%, rgb(37 42 58 / 0.28) 55%, transparent 100%)",
              }}
            />
          </div>
          <Logo
            className="absolute left-1/2 top-[3%] -translate-x-1/2"
            tone="dark"
          />
        </div>
      );

    case "banner":
      return (
        <div className="absolute inset-0 overflow-hidden bg-periwinkle-deep">
          <div className="absolute inset-x-0 top-0 h-[78%] overflow-hidden">
            <Photo url={photoUrl} />
          </div>
          <div className="absolute inset-x-0 bottom-0 flex h-[22%] items-center px-[8%]">
            <Logo tone="light" />
          </div>
        </div>
      );

    case "minimal":
      return (
        <div className="absolute inset-0 overflow-hidden">
          <Photo url={photoUrl} />
          <div
            aria-hidden
            className="absolute inset-0"
            style={{ background: "rgb(37 42 58 / 0.4)" }}
          />
          <Logo
            className="absolute left-1/2 top-[5%] -translate-x-1/2"
            tone="light"
          />
        </div>
      );

    case "sidebar":
      return (
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute inset-y-0 left-0 w-[18%] bg-periwinkle" />
          <div className="absolute inset-y-0 left-[18%] right-0 overflow-hidden">
            <Photo url={photoUrl} />
          </div>
          <Logo className="absolute left-[3%] top-[5%]" tone="light" />
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
          <Logo className="absolute left-[8%] top-[7%]" tone="light" />
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

function Logo({
  tone,
  className = "",
}: {
  tone: "light" | "dark";
  className?: string;
}) {
  return (
    <div className={`z-10 flex items-center gap-1.5 ${className}`}>
      <Image src={brand.logo.src} alt="" width={18} height={18} className="shrink-0" />
      <p
        className={`font-sans text-[0.6rem] font-medium tracking-[0.2em] ${
          tone === "light" ? "text-white/90" : "text-ink/80"
        }`}
      >
        OURTAILTALES
      </p>
    </div>
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
