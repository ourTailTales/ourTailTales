"use client";

import { COVER_NAME_ANCHORS } from "@/lib/book/coverLayouts";
import type { CoverNameAnchor } from "@/types/book";

/** A 3×3 grid standing in for the cover, one dot per place the name can sit. */
export function NamePositionPicker({
  value,
  onChange,
}: {
  value: CoverNameAnchor;
  onChange: (anchor: CoverNameAnchor) => void;
}) {
  return (
    <div className="grid grid-cols-3 gap-1.5 rounded-lg border border-page-line bg-white p-2">
      {COVER_NAME_ANCHORS.map((option) => {
        const active = value === option.id;
        return (
          <button
            key={option.id}
            type="button"
            onClick={() => onChange(option.id)}
            title={option.label}
            aria-label={option.label}
            aria-pressed={active}
            className={`relative aspect-square rounded-md border transition-colors ${
              active
                ? "border-periwinkle bg-periwinkle/10"
                : "border-page-line/70 hover:border-periwinkle/50 hover:bg-periwinkle/5"
            }`}
          >
            <span
              aria-hidden
              className={`absolute h-1.5 w-1.5 rounded-full transition-colors ${
                active ? "bg-periwinkle" : "bg-page-ink/25"
              }`}
              style={{
                left: `${option.dot.x}%`,
                top: `${option.dot.y}%`,
                transform: "translate(-50%, -50%)",
              }}
            />
          </button>
        );
      })}
    </div>
  );
}
