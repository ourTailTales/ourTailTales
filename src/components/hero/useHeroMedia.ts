"use client";

import { useEffect, useState } from "react";

/** True when the user prefers reduced motion (or SSR-safe default false). */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  return reduced;
}

/** Client-only media query. Starts false to keep SSR and the first paint aligned. */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const media = window.matchMedia(query);
    const update = () => setMatches(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, [query]);

  return matches;
}

/** Coarse pointer / no-hover ≈ touch-first interaction. */
export function useTouchPrimary(): boolean {
  const [touch, setTouch] = useState(false);

  useEffect(() => {
    const hover = window.matchMedia("(hover: hover) and (pointer: fine)");
    const update = () => setTouch(!hover.matches);
    update();
    hover.addEventListener("change", update);
    return () => hover.removeEventListener("change", update);
  }, []);

  return touch;
}
