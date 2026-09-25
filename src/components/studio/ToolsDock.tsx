"use client";

import { ChevronDown, Plus, X } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";

import { useDialogA11y } from "@/lib/a11y/useDialog";

export type ToolSection = {
  id: string;
  /** What the button says, and the heading of the sheet it opens. */
  label: string;
  icon: ReactNode;
  /** Built on open, so a panel's state starts fresh with the page it is for. */
  panel: () => ReactNode;
};

/**
 * The editor's tools on a phone.
 *
 * They used to sit under the page and under the filmstrip, which meant that
 * changing anything about the book began with scrolling the book off the
 * screen. This is the same tools reached without losing sight of the page: a
 * button in the corner of the thumb's reach, opening into one circle per
 * panel, each of which lifts that panel up over the page in a sheet the page
 * is still visible above.
 */
export function ToolsDock({ sections }: { sections: ToolSection[] }) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<string | null>(null);
  const section = sections.find((entry) => entry.id === active) ?? null;

  // A page change closes whatever was open: the panel belonged to the page
  // that has just gone.
  const ids = sections.map((entry) => entry.id).join("|");
  useEffect(() => {
    setActive((current) => (current && ids.includes(current) ? current : null));
  }, [ids]);

  if (sections.length === 0) return null;

  return (
    <>
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex flex-col items-end gap-2.5 px-4 pb-5 lg:hidden">
        {open
          ? sections.map((entry) => (
              <button
                key={entry.id}
                type="button"
                onClick={() => {
                  setActive(entry.id);
                  setOpen(false);
                }}
                className="pointer-events-auto flex items-center gap-2.5"
              >
                <span className="rounded-full bg-page-ink/85 px-3 py-1 text-xs font-medium text-white shadow-sm">
                  {entry.label}
                </span>
                <span className="flex size-12 items-center justify-center rounded-full border border-page-line bg-white text-periwinkle-deep shadow-lift">
                  {entry.icon}
                </span>
              </button>
            ))
          : null}

        <button
          type="button"
          onClick={() => setOpen((current) => !current)}
          aria-expanded={open}
          aria-label={open ? "Hide editing tools" : "Edit this page"}
          className="pointer-events-auto flex size-14 items-center justify-center rounded-full bg-periwinkle text-white shadow-lift transition-transform hover:bg-periwinkle-deep active:scale-95"
        >
          {open ? (
            <ChevronDown aria-hidden className="size-6" strokeWidth={2.25} />
          ) : (
            <Plus aria-hidden className="size-6" strokeWidth={2.25} />
          )}
        </button>
      </div>

      {section ? (
        <ToolSheet title={section.label} onClose={() => setActive(null)}>
          {section.panel()}
        </ToolSheet>
      ) : null}
    </>
  );
}

/** One panel, lifted over the page with the page still showing above it. */
function ToolSheet({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  useDialogA11y(panelRef, { onClose });

  return (
    <div className="fixed inset-0 z-50 lg:hidden">
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 w-full cursor-default bg-page-ink/35 backdrop-blur-[1px]"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="absolute inset-x-0 bottom-0 max-h-[82dvh] overflow-y-auto overscroll-contain rounded-t-2xl bg-white shadow-[0_-12px_40px_-16px_rgb(25_32_58/0.45)]"
      >
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-page-line bg-white/95 px-5 py-3 backdrop-blur">
          <span aria-hidden className="absolute inset-x-0 -top-0 mx-auto h-1 w-10 rounded-full" />
          <h2 className="font-display text-base text-page-ink">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex size-9 items-center justify-center rounded-full text-page-ink-soft transition-colors hover:bg-memory-blue/40 hover:text-page-ink"
          >
            <X aria-hidden className="size-4.5" />
          </button>
        </div>
        <div className="px-5 pb-8 pt-4">{children}</div>
      </div>
    </div>
  );
}
