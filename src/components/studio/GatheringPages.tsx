"use client";

import { useEffect, useRef } from "react";

import { EASE, animate, countTo, createTimeline, motionOk } from "@/lib/motion";

/**
 * What the wait looks like.
 *
 * A spinner says a computer is busy. This says a book is being made: sheets
 * settling one after another into a stack, unhurried, on a loop. It replaces
 * the spinner on the one screen where somebody is waiting long enough to
 * wonder whether anything is happening, and where what they are waiting for is
 * a book about an animal they love.
 *
 * The progress underneath is driven rather than transitioned, so the bar and
 * the number move together and neither snaps.
 */
export function GatheringPages({
  done,
  label,
}: {
  /** 0 to 1. */
  done: number;
  /** Read out to anyone who cannot see the sheets move. */
  label: string;
}) {
  const stack = useRef<HTMLDivElement>(null);
  const bar = useRef<HTMLSpanElement>(null);
  const percent = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const host = stack.current;
    if (!host || !motionOk()) return;

    const sheets = Array.from(host.querySelectorAll("[data-sheet]"));
    const loop = createTimeline({ loop: true, defaults: { ease: EASE.paper } });

    sheets.forEach((sheet, index) => {
      loop
        .add(
          sheet,
          { translateY: -14, rotate: index % 2 ? 2.2 : -2.2, duration: 520 },
          index * 420,
        )
        .add(sheet, { translateY: 0, rotate: 0, duration: 680 }, index * 420 + 520);
    });

    return () => {
      loop.revert();
    };
  }, []);

  useEffect(() => {
    const share = Math.max(0.04, Math.min(1, done));
    countTo(percent.current, Math.round(share * 100), (value) =>
      `${Math.round(value)}%`,
    );
    if (!bar.current) return;
    if (!motionOk()) {
      bar.current.style.width = `${share * 100}%`;
      return;
    }
    animate(bar.current, {
      width: `${share * 100}%`,
      duration: 700,
      ease: EASE.paper,
    });
  }, [done]);

  return (
    <div className="flex flex-col items-center gap-6">
      <div
        ref={stack}
        aria-hidden
        className="relative h-16 w-[4.5rem]"
      >
        {[0, 1, 2].map((index) => (
          <div
            key={index}
            data-sheet
            className="absolute inset-x-0 rounded-[3px] border border-page-line bg-white shadow-sm"
            style={{
              height: "3.25rem",
              bottom: `${index * 5}px`,
              left: `${index * 2}px`,
              right: `${index * -2}px`,
              zIndex: 3 - index,
            }}
          />
        ))}
      </div>

      <p role="status" className="text-center font-display text-xl text-page-ink">
        {label}
      </p>

      <div className="flex items-center gap-3">
        <div
          className="h-1.5 w-48 overflow-hidden rounded-full bg-page-line"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(Math.max(0.04, Math.min(1, done)) * 100)}
          aria-label={label}
        >
          <span
            ref={bar}
            className="block h-full rounded-full bg-periwinkle"
            style={{ width: "4%" }}
          />
        </div>
        <span
          ref={percent}
          data-count="0"
          className="w-9 text-right text-xs tabular-nums text-page-ink-faint"
        >
          4%
        </span>
      </div>
    </div>
  );
}
