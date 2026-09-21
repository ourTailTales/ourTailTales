"use client";

import { BackCoverArt } from "@/components/book-viewer/CoverArt";
import type { BookMeta } from "@/types/book";

const inputClass =
  "w-full rounded-lg border border-page-line bg-white px-3.5 py-2.5 text-page-ink outline-none transition-colors placeholder:text-page-ink-faint focus:border-periwinkle focus:ring-2 focus:ring-periwinkle/20";

export function BackCoverEditor({
  meta,
  onMetaChange,
}: {
  meta: BookMeta;
  onMetaChange: (patch: Partial<BookMeta>) => void;
}) {
  return (
    <section className="space-y-5">
      <div className="grid gap-6 sm:grid-cols-[minmax(0,11rem)_1fr]">
        <div className="mx-auto aspect-square w-full max-w-[11rem] overflow-hidden rounded-lg bg-[#e4ddd0] shadow-lift sm:mx-0">
          <BackCoverArt dedication={meta.dedication} />
        </div>

        <div className="space-y-2">
          <label className="block">
            <span className="mb-1.5 flex items-baseline justify-between text-sm font-medium text-page-ink-soft">
              <span>Dedication</span>
              <span className="text-xs font-normal text-page-ink-faint">
                {meta.dedication.length}/320
              </span>
            </span>
            <textarea
              value={meta.dedication}
              onChange={(event) =>
                onMetaChange({ dedication: event.target.value.slice(0, 320) })
              }
              rows={5}
              placeholder="For the best copilot a family could ask for."
              className={`${inputClass} resize-none leading-relaxed`}
            />
          </label>
          <p className="text-xs text-page-ink-faint">
            This also appears on the dedication page inside the book.
          </p>
        </div>
      </div>
    </section>
  );
}
