"use client";

import { Clock } from "lucide-react";
import { useEffect, useState } from "react";

/**
 * A literal countdown, at the customer's explicit request — not the calm
 * "Expires in N days" statement the rest of the product uses for this same
 * data (`lib/drafts/expiry.ts`), which exists specifically because the brand
 * rules rule out manufactured urgency. This screen breaks from that on
 * purpose. It stays quiet in tone regardless: no red, no exclamation points,
 * just the clock ticking next to a plain explanation of what it means.
 */

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** Seconds only show once there's under a minute left — past that a tenths
 *  digit next to a day count is noise, not information. */
export function formatCountdown(remainingMs: number): string {
  if (remainingMs <= 0) return "0s";
  const days = Math.floor(remainingMs / DAY);
  const hours = Math.floor((remainingMs % DAY) / HOUR);
  const minutes = Math.floor((remainingMs % HOUR) / MINUTE);
  const seconds = Math.floor((remainingMs % MINUTE) / SECOND);

  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

/**
 * The countdown at the top of a signed-out reader's first look at their book.
 *
 * Ticks every second off a local `now`, against the expiry the teaser bank
 * returned when the book was uploaded. Renders nothing once that time is up
 * or hasn't arrived yet — the upload it depends on runs in the background and
 * is not awaited, so the first render or two of this screen may have no
 * expiry to show at all.
 */
export function ExpiryCountdown({ expiresAt }: { expiresAt: Date }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const remaining = expiresAt.getTime() - now;
  if (remaining <= 0) return null;

  return (
    <div
      role="status"
      className="flex items-center justify-center gap-2 rounded-xl border border-page-line bg-white/70 px-4 py-2.5 text-center text-xs text-page-ink-soft sm:justify-start sm:text-left"
    >
      <Clock aria-hidden className="size-3.5 shrink-0 text-page-ink-faint" />
      <span>
        This free preview is saved for{" "}
        <span className="font-semibold tabular-nums text-page-ink">
          {formatCountdown(remaining)}
        </span>{" "}
        more — make an account to keep it for good.
      </span>
    </div>
  );
}
