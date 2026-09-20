import { ArrowLeft, ArrowRight } from "lucide-react";

export function PageTurnLink({
  direction,
  enabled = true,
  onClick,
}: {
  direction: "next" | "prev";
  enabled?: boolean;
  onClick?: () => void;
}) {
  const className = `inline-flex items-center gap-1 font-display text-base font-semibold tracking-wide underline decoration-line underline-offset-4 ${
    enabled ? "text-periwinkle" : "text-ink/35 no-underline"
  }`;
  const label =
    direction === "prev" ? (
      <>
        <ArrowLeft aria-hidden className="h-4 w-4" strokeWidth={2.25} />
        Previous
      </>
    ) : (
      <>
        Next
        <ArrowRight aria-hidden className="h-4 w-4" strokeWidth={2.25} />
      </>
    );

  if (onClick) {
    return (
      <button
        type="button"
        data-hero-hit={direction}
        disabled={!enabled}
        onClick={onClick}
        className={`${className} bg-transparent p-0 disabled:cursor-not-allowed`}
      >
        {label}
      </button>
    );
  }

  return (
    <span data-hero-hit={direction} className={className}>
      {label}
    </span>
  );
}
