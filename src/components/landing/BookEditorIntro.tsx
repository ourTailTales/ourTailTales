import { EditorProgressTimeline } from "@/components/landing/EditorProgressTimeline";

/** Label strip under the mockup carousel — leads into the interactive book. */
export function BookEditorIntro({
  activeIndex = 0,
  farthestIndex = 0,
  onSelect,
}: {
  activeIndex?: number;
  farthestIndex?: number;
  onSelect?: (index: number) => void;
}) {
  return (
    <div className="relative">
      <div className="mx-auto grid max-w-[90rem] items-center gap-5 overflow-visible px-4 pt-5 pb-3 sm:gap-8 sm:px-8 sm:pt-10 sm:pb-0 lg:grid-cols-[minmax(12rem,0.7fr)_minmax(22rem,1.8fr)] lg:gap-12">
        <div>
          <p className="mb-1 font-display text-xs text-periwinkle sm:text-base">
            Done in 15 minutes
          </p>
          <h2 className="font-display text-2xl font-bold text-page-ink sm:text-4xl">
            Book Editor
          </h2>
          <p className="mt-1.5 max-w-md text-sm leading-5 text-page-ink-soft sm:mt-2 sm:text-base sm:leading-6">
            Drop in their album. Shape the chapters. Keep the hardcover.
          </p>
        </div>
        <EditorProgressTimeline
          activeIndex={activeIndex}
          farthestIndex={farthestIndex}
          onSelect={onSelect}
        />
      </div>
    </div>
  );
}
