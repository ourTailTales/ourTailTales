"use client";

import { useEffect, useRef } from "react";

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Makes an already-rendered `role="dialog"` panel behave like one.
 *
 * Every modal in the product opened with the same shape — a backdrop, a
 * panel, an Escape listener — and none of them did the rest of what a dialog
 * has to: Tab could walk straight out of it into the page behind, nothing was
 * focused on open beyond a single input, closing left focus wherever it had
 * drifted rather than back on whatever opened it, and the page behind kept
 * scrolling under a thumb meant for the dialog.
 *
 * Takes a ref to the panel that already exists rather than rendering one, so
 * it drops into a component without restructuring its markup: attach the ref,
 * call the hook, and the old local Escape effect can go.
 */
export function useDialogA11y(
  containerRef: React.RefObject<HTMLElement | null>,
  options: {
    onClose: () => void;
    /** Focused on open instead of the first focusable element, when set. */
    initialFocusRef?: React.RefObject<HTMLElement | null>;
  },
): void {
  const { onClose, initialFocusRef } = options;
  // Read through a ref so the effect below does not need `onClose` in its
  // dependency array — a new function identity every render must not reopen
  // the trap and steal focus back from whatever the customer just did. Kept
  // current in its own effect rather than assigned during render, which a
  // ref must never be.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const { body } = document;
    const previousOverflow = body.style.overflow;
    body.style.overflow = "hidden";

    const focusables = (): HTMLElement[] => {
      const root = containerRef.current;
      if (!root) return [];
      return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE));
    };

    (initialFocusRef?.current ?? focusables()[0])?.focus();

    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab") return;

      const items = focusables();
      if (items.length === 0) return;

      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement as HTMLElement | null;

      if (!active || !items.includes(active)) {
        // Focus is not in the dialog at all — pull it back rather than let
        // the next Tab decide where it lands.
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      } else if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    // Capture phase: this must see Escape and Tab before anything inside the
    // dialog (a text input, a button) has a chance to stop it.
    document.addEventListener("keydown", onKeyDown, true);

    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      body.style.overflow = previousOverflow;
      previouslyFocused?.focus?.();
    };
    // containerRef and initialFocusRef are refs — stable identity, and only
    // .current is read — so listing them re-runs this on every render for no
    // reason; the mount/unmount behaviour below is deliberately one-shot.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
