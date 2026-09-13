"use client";

import { useEffect, useRef, useState, type RefObject } from "react";

/** Open when the book center is this close to the viewport center (vh). */
const OPEN_BAND = 0.32;
/** Close only after the book is this far from center (vh) — hysteresis. */
const CLOSE_BAND = 0.55;
/** Either-direction close if even farther (covers scroll-up). */
const FAR_BAND = 0.72;

export function useCoverProximity(
  ref: RefObject<Element | null>,
  { enabled = true }: { enabled?: boolean } = {},
) {
  const [inOpenBand, setInOpenBand] = useState(false);
  const [farAway, setFarAway] = useState(true);
  const inOpenBandRef = useRef(false);

  useEffect(() => {
    if (!enabled) {
      setInOpenBand(false);
      setFarAway(false);
      inOpenBandRef.current = false;
      return;
    }

    let raf = 0;

    const measure = () => {
      const el = ref.current;
      if (!el) return;

      const rect = el.getBoundingClientRect();
      const bookCenter = rect.top + rect.height / 2;
      const viewCenter = window.innerHeight / 2;
      const dist = Math.abs(bookCenter - viewCenter) / window.innerHeight;
      const scrolledDown = bookCenter < viewCenter;

      const nextOpen = (() => {
        const prev = inOpenBandRef.current;
        if (!prev && dist <= OPEN_BAND) return true;
        if (prev && dist >= CLOSE_BAND && scrolledDown) return false;
        if (prev && dist >= FAR_BAND) return false;
        return prev;
      })();

      inOpenBandRef.current = nextOpen;
      setInOpenBand(nextOpen);
      setFarAway(dist >= CLOSE_BAND && (scrolledDown || dist >= FAR_BAND));
    };

    const schedule = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        measure();
      });
    };

    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    const io = new IntersectionObserver(schedule, {
      threshold: [0, 0.15, 0.35, 0.55, 0.75, 1],
    });
    if (ref.current) io.observe(ref.current);
    measure();

    return () => {
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      io.disconnect();
    };
  }, [enabled, ref]);

  return { inOpenBand, farAway };
}
