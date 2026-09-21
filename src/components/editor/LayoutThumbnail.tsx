import type { CoverLayoutId } from "@/types/book";

/**
 * Miniature skeleton thumbnail showing the shape of a cover layout.
 * Used in the layout carousel so the customer can see what each layout
 * looks like before selecting it.
 */
export function LayoutThumbnail({
  layoutId,
  petName,
  active,
  onClick,
}: {
  layoutId: CoverLayoutId;
  petName: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group relative flex-none snap-center overflow-hidden rounded-lg border-2 transition-all ${
        active
          ? "border-periwinkle shadow-md"
          : "border-line hover:border-periwinkle/50"
      }`}
      style={{ width: 120, height: 120 }}
      title={layoutId.charAt(0).toUpperCase() + layoutId.slice(1)}
    >
      <SkeletonLayout layoutId={layoutId} petName={petName} />
      <span
        className={`absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink/60 to-transparent px-2 pb-1.5 pt-4 text-center text-[10px] font-medium capitalize tracking-wide text-white ${
          active ? "opacity-100" : "opacity-80 group-hover:opacity-100"
        }`}
      >
        {layoutId}
      </span>
    </button>
  );
}

/** Pure-CSS skeleton that mirrors the geometry of each CoverLayoutChrome layout. */
function SkeletonLayout({
  layoutId,
  petName,
}: {
  layoutId: CoverLayoutId;
  petName: string;
}) {
  const name = petName || "Name";

  switch (layoutId) {
    case "framed":
      return (
        <div className="absolute inset-0 bg-[#e8e2d8]">
          <div className="absolute inset-[7%] rounded-sm bg-[#c8d0dc]/60" />
          <div className="absolute inset-[7%] flex items-end justify-center pb-2">
            <span className="text-[9px] font-semibold text-ink/70">{name}</span>
          </div>
        </div>
      );

    case "banner":
      return (
        <div className="absolute inset-0 bg-[#c8d0dc]/60">
          <div className="absolute inset-x-0 bottom-0 h-[22%] bg-periwinkle-deep" />
          <div className="absolute inset-x-0 bottom-[22%] flex items-end justify-center pb-2">
            <span className="text-[9px] font-semibold text-ink/70">{name}</span>
          </div>
        </div>
      );

    case "minimal":
      return (
        <div className="absolute inset-0 bg-[#c8d0dc]/60">
          <div className="absolute inset-0 bg-ink/30" />
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-[9px] font-semibold text-white/90">{name}</span>
          </div>
        </div>
      );

    case "sidebar":
      return (
        <div className="absolute inset-0 bg-[#c8d0dc]/60">
          <div className="absolute inset-y-0 left-0 w-[18%] bg-periwinkle" />
          <div className="absolute inset-y-0 left-[18%] right-0 flex items-end justify-center pb-3">
            <span className="text-[9px] font-semibold text-ink/70">{name}</span>
          </div>
        </div>
      );

    case "classic":
    default:
      return (
        <div className="absolute inset-0 bg-[#c8d0dc]/60">
          <div
            className="absolute inset-x-0 bottom-0 h-[36%]"
            style={{
              background:
                "linear-gradient(to top, rgb(37 42 58 / 0.55) 0%, transparent 100%)",
            }}
          />
          <div className="absolute inset-x-0 bottom-0 flex h-[36%] items-end justify-start pb-2 pl-3">
            <span className="text-[9px] font-semibold text-white/90">{name}</span>
          </div>
        </div>
      );
  }
}
