"use client";

import { useEffect } from "react";
import Link from "next/link";

import { BrandMark } from "@/components/BrandMark";

/**
 * Route-segment error boundary.
 *
 * Someone reaching this has usually just handed us a photo album of a pet that
 * has died. The default framework error page is the wrong thing to show them,
 * so this says what is true, promises nothing about their photos it cannot
 * keep, and offers the one action that helps.
 */
export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Surfaces in Vercel logs and PostHog's exception autocapture.
    console.error("[ourTailTales] Unhandled error", error);
  }, [error]);

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-5 pb-16 pt-6 sm:px-8">
      <BrandMark href="/" size="md" />
      <section className="mt-10 rounded-[1.75rem] border border-page-line bg-white/95 p-8 text-center shadow-[0_24px_70px_-30px_rgb(25_32_58/0.55)]">
        <h1 className="font-display text-3xl font-bold text-page-ink">
          Something went wrong on our side
        </h1>
        <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-page-ink-soft">
          Not your fault, and nothing you were working on has been thrown away —
          your photos stay on your own device until you choose to order. Trying
          again usually works.
        </p>
        <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <button
            type="button"
            onClick={reset}
            className="inline-flex min-h-11 items-center justify-center rounded-xl bg-periwinkle px-6 py-3 text-sm font-semibold text-white shadow-lift hover:bg-periwinkle-deep"
          >
            Try again
          </button>
          <Link
            href="/"
            className="inline-flex min-h-11 items-center justify-center rounded-xl border border-page-line bg-white px-6 py-3 text-sm font-semibold text-page-ink hover:border-periwinkle"
          >
            Back to the start
          </Link>
        </div>
        {error.digest && (
          <p className="mt-6 text-xs text-page-ink-faint">
            If you write to us, this code helps us find it: {error.digest}
          </p>
        )}
      </section>
    </main>
  );
}
