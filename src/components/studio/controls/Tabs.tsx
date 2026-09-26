"use client";

import { useId, useRef, useState, type ReactNode } from "react";

export type Tab = {
  id: string;
  label: string;
  /** Built on demand, so a tab nobody opens costs nothing. */
  content: () => ReactNode;
};

/**
 * The tools for one page, a few at a time.
 *
 * Everything a photo page can be given — its layout, the photographs on it,
 * the words beside them, and now the videos whose codes are printed on it —
 * stacked in one column meant a panel nobody could see the bottom of, and the
 * thing being looked for was always below the fold. One at a time, and the
 * labels say what the page can have.
 */
export function Tabs({
  tabs,
  label,
  initial,
}: {
  tabs: Tab[];
  /** Names the set for a screen reader: "Cover tools", "Page 4 tools". */
  label: string;
  initial?: string;
}) {
  const group = useId();
  const [active, setActive] = useState(() => initial ?? tabs[0]?.id ?? "");
  const buttons = useRef(new Map<string, HTMLButtonElement>());

  const current = tabs.find((tab) => tab.id === active) ?? tabs[0];
  if (!current) return null;

  // Arrow keys move between tabs, per the WAI-ARIA tabs pattern: only the
  // selected tab is in the page's Tab order, so the panel below is one Tab
  // away rather than four.
  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>): void => {
    const at = tabs.findIndex((tab) => tab.id === current.id);
    const to =
      event.key === "ArrowRight"
        ? (at + 1) % tabs.length
        : event.key === "ArrowLeft"
          ? (at - 1 + tabs.length) % tabs.length
          : event.key === "Home"
            ? 0
            : event.key === "End"
              ? tabs.length - 1
              : -1;
    if (to === -1) return;
    event.preventDefault();
    const next = tabs[to];
    if (!next) return;
    setActive(next.id);
    buttons.current.get(next.id)?.focus();
  };

  return (
    <div>
      <div
        role="tablist"
        aria-label={label}
        onKeyDown={onKeyDown}
        className="flex gap-1 rounded-xl bg-memory-blue/40 p-1"
      >
        {tabs.map((tab) => {
          const selected = tab.id === current.id;
          return (
            <button
              key={tab.id}
              ref={(node) => {
                if (node) buttons.current.set(tab.id, node);
                else buttons.current.delete(tab.id);
              }}
              type="button"
              role="tab"
              id={`${group}-${tab.id}-tab`}
              aria-selected={selected}
              aria-controls={`${group}-${tab.id}-panel`}
              tabIndex={selected ? 0 : -1}
              onClick={() => setActive(tab.id)}
              className={`min-h-9 flex-1 rounded-lg px-2 text-xs font-semibold transition-colors ${
                selected
                  ? "bg-white text-periwinkle-deep shadow-sm"
                  : "text-page-ink-soft hover:text-page-ink"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      <div
        role="tabpanel"
        id={`${group}-${current.id}-panel`}
        aria-labelledby={`${group}-${current.id}-tab`}
        tabIndex={0}
        className="mt-4 focus-visible:outline-none"
      >
        {current.content()}
      </div>
    </div>
  );
}
