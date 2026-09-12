"use client";

export function NavigationControls({
  onPrev,
  onNext,
  canPrev,
  canNext,
  disabled,
}: {
  onPrev: () => void;
  onNext: () => void;
  canPrev: boolean;
  canNext: boolean;
  disabled?: boolean;
}) {
  return (
    <div className="bv-nav">
      <button
        type="button"
        className="bv-nav__btn"
        onClick={onPrev}
        disabled={disabled || !canPrev}
        aria-label="Previous page"
      >
        Previous
      </button>
      <button
        type="button"
        className="bv-nav__btn"
        onClick={onNext}
        disabled={disabled || !canNext}
        aria-label="Next page"
      >
        Next
      </button>
    </div>
  );
}
