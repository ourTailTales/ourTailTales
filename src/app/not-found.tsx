import Link from "next/link";

import { BrandMark } from "@/components/BrandMark";

export default function NotFound() {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-5 pb-16 pt-6 sm:px-8">
      <BrandMark href="/" size="md" />
      <section className="mt-10 rounded-[1.75rem] border border-page-line bg-white/95 p-8 text-center shadow-[0_24px_70px_-30px_rgb(25_32_58/0.55)]">
        <h1 className="font-display text-3xl font-bold text-page-ink">
          There is nothing at this link
        </h1>
        <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-page-ink-soft">
          It may have been mistyped, or it may be a free book whose 30 days have
          passed. Either way, making a new one takes a couple of minutes.
        </p>
        <Link
          href="/create"
          className="mt-7 inline-flex min-h-11 items-center justify-center rounded-xl bg-periwinkle px-6 py-3 text-sm font-semibold text-white shadow-lift hover:bg-periwinkle-deep"
        >
          Make a book
        </Link>
      </section>
    </main>
  );
}
