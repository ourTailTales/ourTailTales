"use client";

/**
 * "Skip to content," first in the page's tab order.
 *
 * Every route has exactly one `<main>`, but nothing pins an id to it (the
 * `/create` flow's own main already carries `id="create-free-book"` for an
 * unrelated external anchor link, so this doesn't add a second one). Rather
 * than thread a shared id through every page, the link finds the main
 * landmark itself and moves focus there directly.
 */
export function SkipLink() {
  return (
    <a
      href="#main-content"
      className="sr-only focus-visible:not-sr-only focus-visible:fixed focus-visible:left-3 focus-visible:top-3 focus-visible:z-[100] focus-visible:rounded-lg focus-visible:bg-periwinkle focus-visible:px-4 focus-visible:py-2 focus-visible:text-sm focus-visible:font-semibold focus-visible:text-white focus-visible:shadow-lift"
      onClick={(event) => {
        const main = document.querySelector("main");
        if (!main) return;
        event.preventDefault();
        if (!main.hasAttribute("tabindex")) {
          main.setAttribute("tabindex", "-1");
        }
        main.focus();
        main.scrollIntoView({ block: "start" });
      }}
    >
      Skip to content
    </a>
  );
}
