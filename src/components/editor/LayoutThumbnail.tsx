import { Check, Lock } from "lucide-react";

import {
  CLASSIC_SCRIM_HEIGHT,
  KEEPSAKE_RULES,
  PORTRAIT_WINDOW,
  coverLayoutSpec,
} from "@/lib/book/coverLayouts";
import type { CoverLayoutId } from "@/types/book";

/**
 * One cover style as a small square: a miniature of the cover itself, its
 * name under it, and a badge saying whether it is the one in use or one an
 * account opens.
 *
 * A miniature rather than a generic icon, because the thing being chosen is
 * a composition — where the photo sits, whether there is a photo at all —
 * and a row of identical picture icons would say none of that.
 */
export function LayoutThumbnail({
  layoutId,
  petName,
  active,
  locked = false,
  onClick,
}: {
  layoutId: CoverLayoutId;
  petName: string;
  active: boolean;
  /** Shown, but not available without an account. */
  locked?: boolean;
  onClick: () => void;
}) {
  const spec = coverLayoutSpec(layoutId);

  return (
    <button
      type="button"
      onClick={onClick}
      role="radio"
      aria-checked={active}
      aria-label={`${spec.label} cover${locked ? " — needs an account" : ""}`}
      title={locked ? `${spec.label} — ${spec.description} Free account required.` : spec.description}
      className={`group relative block w-full overflow-hidden rounded-lg border-2 text-left transition-all ${
        active
          ? "border-periwinkle shadow-md"
          : "border-line hover:border-periwinkle/50"
      }`}
    >
      <span
        className={`relative block aspect-square w-full ${
          locked ? "opacity-60 grayscale-[0.35]" : ""
        }`}
      >
        <SkeletonLayout layoutId={layoutId} petName={petName} />
      </span>

      {active ? (
        <span className="absolute right-1.5 top-1.5 flex size-6 items-center justify-center rounded-full bg-periwinkle text-white shadow-sm">
          <Check aria-hidden className="size-3.5" strokeWidth={3} />
        </span>
      ) : locked ? (
        <span className="absolute right-1.5 top-1.5 flex size-6 items-center justify-center rounded-full bg-ink/70 text-white shadow-sm">
          <Lock aria-hidden className="size-3" strokeWidth={2.5} />
        </span>
      ) : null}

      {/* Under the square rather than over it: the name of the style and the
          pet's name in the miniature were landing on top of each other, and
          the one thing a cover picker has to be is legible. */}
      <span
        className={`block border-t px-2 py-1.5 text-center text-[0.7rem] font-medium ${
          active
            ? "border-periwinkle/40 bg-periwinkle-wash/50 text-periwinkle-deep"
            : "border-line bg-white text-page-ink-soft"
        }`}
      >
        {spec.label}
      </span>
    </button>
  );
}

const PHOTO_TINT = "bg-[#c8d0dc]/60";

/** Pure-CSS skeleton that mirrors the geometry of each CoverLayoutChrome layout. */
function SkeletonLayout({
  layoutId,
  petName,
}: {
  layoutId: CoverLayoutId;
  petName: string;
}) {
  const name = petName || "Type name here";

  switch (layoutId) {
    case "minimal":
      return (
        <div className={`absolute inset-0 ${PHOTO_TINT}`}>
          <div className="absolute inset-0 bg-ink/30" />
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="truncate px-2 text-[9px] font-semibold text-white/90">{name}</span>
          </div>
        </div>
      );

    case "editorial":
      return (
        <div className={`absolute inset-0 ${PHOTO_TINT}`}>
          <div className="absolute inset-x-0 top-[40%] h-[27%] bg-ink/70" />
          <div className="absolute inset-x-0 top-[40%] flex h-[27%] items-center justify-center">
            <span className="truncate px-2 text-[10px] font-semibold text-white/90">{name}</span>
          </div>
        </div>
      );

    case "portrait":
      return (
        <div className="absolute inset-0 bg-cream">
          <div
            className="absolute bg-white shadow-sm"
            style={{
              left: `${(PORTRAIT_WINDOW.x - 0.03) * 100}%`,
              top: `${(PORTRAIT_WINDOW.y - 0.03) * 100}%`,
              width: `${(PORTRAIT_WINDOW.w + 0.06) * 100}%`,
              height: `${(PORTRAIT_WINDOW.h + 0.06) * 100}%`,
            }}
          />
          <div
            className={PHOTO_TINT}
            style={{
              position: "absolute",
              left: `${PORTRAIT_WINDOW.x * 100}%`,
              top: `${PORTRAIT_WINDOW.y * 100}%`,
              width: `${PORTRAIT_WINDOW.w * 100}%`,
              height: `${PORTRAIT_WINDOW.h * 100}%`,
            }}
          />
          <div className="absolute inset-x-0 top-[78%] flex justify-center">
            <span className="truncate px-2 text-[9px] font-semibold text-ink/80">{name}</span>
          </div>
        </div>
      );

    case "keepsake":
      return (
        <div className="absolute inset-0 bg-cream">
          {KEEPSAKE_RULES.map((inset) => (
            <div
              key={inset}
              className="absolute border border-ink/25"
              style={{ inset: `${inset * 100}%` }}
            />
          ))}
          <div className="absolute inset-x-0 top-[20%] flex justify-center">
            <span aria-hidden className="text-[11px] leading-none text-periwinkle">
              &#128062;
            </span>
          </div>
          <div className="absolute inset-x-0 top-[46%] flex justify-center">
            <span className="truncate px-2 text-[9px] font-semibold text-ink/80">{name}</span>
          </div>
          <div className="absolute left-1/2 top-[62%] h-px w-[26%] -translate-x-1/2 bg-periwinkle/70" />
        </div>
      );

    case "monogram":
      return (
        <div className="absolute inset-0 bg-cream">
          <span
            aria-hidden
            className="absolute left-1/2 top-[44%] -translate-x-1/2 -translate-y-1/2 font-cover text-[42px] leading-none text-periwinkle/25"
          >
            {name.slice(0, 1).toUpperCase()}
          </span>
          <div className="absolute inset-x-0 top-[46%] flex -translate-y-1/2 justify-center">
            <span className="truncate px-2 text-[9px] font-semibold text-ink/80">{name}</span>
          </div>
          <div className="absolute left-1/2 top-[62%] h-px w-[26%] -translate-x-1/2 bg-periwinkle/70" />
        </div>
      );

    case "classic":
    default:
      return (
        <div className={`absolute inset-0 ${PHOTO_TINT}`}>
          <div
            className="absolute inset-x-0 bottom-0"
            style={{
              height: `${CLASSIC_SCRIM_HEIGHT * 100}%`,
              background:
                "linear-gradient(to top, rgb(37 42 58 / 0.55) 0%, transparent 100%)",
            }}
          />
          <div className="absolute inset-x-0 bottom-0 flex h-[36%] items-end justify-start pb-2 pl-3">
            <span className="truncate pr-2 text-[9px] font-semibold text-white/90">{name}</span>
          </div>
        </div>
      );
  }
}
