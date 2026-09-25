"use client";

import { Lock } from "lucide-react";

import { LayoutThumbnail } from "@/components/editor/LayoutThumbnail";
import { track } from "@/lib/analytics";
import {
  COVER_LAYOUTS,
  DEFAULT_COVER_LAYOUT,
  coverLayoutUnlocked,
} from "@/lib/book/coverLayouts";
import type { CoverLayoutId } from "@/types/book";

/**
 * The cover styles, all of them, whether or not this reader can have them.
 *
 * Signed out, the picker is not hidden and it is not empty — every style is
 * on the page with a lock on it, because the question somebody is answering
 * at this point is "is there a version of this I would want?", and the honest
 * answer is six of them. Tapping a locked style asks for the account rather
 * than silently doing nothing.
 */
export function CoverStylePicker({
  current,
  petName,
  unlocked,
  onPick,
  onUnlock,
}: {
  current: CoverLayoutId | undefined;
  petName: string;
  /** False for a reader with no account: every style but the free one is locked. */
  unlocked: boolean;
  onPick: (layoutId: CoverLayoutId) => void;
  onUnlock: () => void;
}) {
  const active = current ?? DEFAULT_COVER_LAYOUT;
  const lockedCount = COVER_LAYOUTS.filter(
    (layout) => !coverLayoutUnlocked(layout.id, unlocked),
  ).length;

  return (
    <div>
      <div role="radiogroup" aria-label="Cover style" className="grid grid-cols-3 gap-2">
        {COVER_LAYOUTS.map((layout) => {
          const available = coverLayoutUnlocked(layout.id, unlocked);
          return (
            <LayoutThumbnail
              key={layout.id}
              layoutId={layout.id}
              petName={petName || "Type name here"}
              active={active === layout.id}
              locked={!available}
              onClick={() => {
                if (!available) {
                  track("cover_style_locked_tapped", { cover: layout.id });
                  onUnlock();
                  return;
                }
                if (active !== layout.id) {
                  onPick(layout.id);
                  track("cover_style_changed", { cover: layout.id });
                }
              }}
            />
          );
        })}
      </div>

      {lockedCount > 0 ? (
        <p className="mt-2.5 flex items-start gap-1.5 text-[0.7rem] leading-4 text-page-ink-faint">
          <Lock aria-hidden className="mt-px size-3 shrink-0" />
          <span>
            {lockedCount} more cover {lockedCount === 1 ? "style" : "styles"} — including two
            with no photo at all, just their name and years — come with a free account.
          </span>
        </p>
      ) : null}
    </div>
  );
}
