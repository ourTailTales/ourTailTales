"use client";

import type { EditorSection } from "@/components/editor/BookSectionNav";

export function OtherPagesEditor({
  onSelect,
}: {
  onSelect: (section: EditorSection) => void;
}) {
  return (
    <section className="space-y-5">
      <div>
        <h3 className="font-display text-lg text-page-ink">Other pages</h3>
        <p className="mt-1 text-sm text-page-ink-soft">
          A few pages are built automatically from the rest of the book and
          don&rsquo;t have their own settings.
        </p>
      </div>

      <ul className="space-y-3">
        <li className="rounded-xl border border-page-line bg-white/60 p-4">
          <p className="text-sm font-medium text-page-ink">Title page</p>
          <p className="mt-1 text-xs leading-5 text-page-ink-soft">
            Shows the pet&rsquo;s name, years, and cover photo. Edit those
            under{" "}
            <button
              type="button"
              onClick={() => onSelect({ kind: "cover" })}
              className="text-periwinkle-deep underline decoration-line underline-offset-4 hover:text-periwinkle"
            >
              Cover
            </button>
            .
          </p>
        </li>

        <li className="rounded-xl border border-page-line bg-white/60 p-4">
          <p className="text-sm font-medium text-page-ink">Closing page</p>
          <p className="mt-1 text-xs leading-5 text-page-ink-soft">
            A fixed closing line with a photo chosen automatically from the
            album — not editable here yet.
          </p>
        </li>

        <li className="rounded-xl border border-page-line bg-white/60 p-4">
          <p className="text-sm font-medium text-page-ink">Imprint page</p>
          <p className="mt-1 text-xs leading-5 text-page-ink-soft">
            Standard printing details — the same on every book.
          </p>
        </li>
      </ul>

      <p className="text-xs text-page-ink-faint">
        Looking for the dedication? It&rsquo;s shared with the{" "}
        <button
          type="button"
          onClick={() => onSelect({ kind: "back-cover" })}
          className="text-periwinkle-deep underline decoration-line underline-offset-4 hover:text-periwinkle"
        >
          Back cover
        </button>
        .
      </p>
    </section>
  );
}
