"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * Re-reads the page a few times while a payment is being confirmed.
 *
 * The order page is rendered on the server from the order's status, and the
 * status only changes when Stripe's webhook lands, which is usually a second
 * or two after the customer arrives. Without this they would sit looking at a
 * page that had not caught up until they thought to reload it.
 */
export function AutoRefresh({
  everyMs = 3000,
  times = 20,
}: {
  everyMs?: number;
  times?: number;
}) {
  const router = useRouter();

  useEffect(() => {
    let remaining = times;
    const timer = window.setInterval(() => {
      remaining -= 1;
      router.refresh();
      if (remaining <= 0) window.clearInterval(timer);
    }, everyMs);
    return () => window.clearInterval(timer);
  }, [everyMs, router, times]);

  return null;
}
