"use client";

import { useEffect } from "react";

/**
 * Originals live only in this tab, so closing it loses the book.
 *
 * Browsers refuse to show custom text in the close-tab dialog, so the standard
 * warning is paired with an always-visible in-app banner.
 */
export function KeepTabBanner({ active }: { active: boolean }) {
  useEffect(() => {
    if (!active) return;

    const handleBeforeUnload = (event: BeforeUnloadEvent): void => {
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [active]);

  if (!active) return null;

  return (
    <div className="sticky top-0 z-40 border-b border-periwinkle/25 bg-periwinkle-wash">
      <p className="mx-auto flex max-w-5xl items-center gap-2 px-5 py-2.5 text-sm text-periwinkle-deep">
        <span aria-hidden className="text-base leading-none">
          &#9888;
        </span>
        <span>
          <strong className="font-semibold">Keep this tab open</strong> — closing
          it will lose your current book. Your photos stay on your device while
          you work.
        </span>
      </p>
    </div>
  );
}
