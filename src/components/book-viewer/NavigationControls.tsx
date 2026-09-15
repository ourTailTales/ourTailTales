"use client";

export function NavigationControls({ label }: { label?: string }) {
  if (!label) return null;

  return (
    <div className="bv-nav">
      <p className="bv-nav__label" aria-live="polite">
        {label}
      </p>
    </div>
  );
}
