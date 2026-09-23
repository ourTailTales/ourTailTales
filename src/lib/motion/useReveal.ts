"use client";

import { useEffect, useRef } from "react";

import { reveal } from "@/lib/motion";

/**
 * Bring a screen's contents in, in reading order.
 *
 * Put the returned ref on a container and `data-reveal` on the children that
 * should arrive. Order comes from the DOM, so the animation follows the
 * markup rather than a second list that has to be kept in step with it.
 *
 * `key` is what counts as a new screen. Pass the flow step, not a value that
 * changes while someone is typing, or the form will breathe at them.
 */
export function useReveal<T extends HTMLElement = HTMLDivElement>(
  key: unknown,
  options: { delay?: number; gap?: number } = {},
) {
  const ref = useRef<T>(null);
  const { delay, gap } = options;

  useEffect(() => {
    const host = ref.current;
    if (!host) return;
    reveal(host.querySelectorAll("[data-reveal]"), { delay, gap });
  }, [key, delay, gap]);

  return ref;
}
