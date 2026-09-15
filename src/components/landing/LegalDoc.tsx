import Link from "next/link";
import type { ReactNode } from "react";

import { BrandMark } from "@/components/BrandMark";
import { Footer } from "@/components/landing/Footer";

export function LegalDoc({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: ReactNode;
}) {
  return (
    <div className="landing-rest flex min-h-dvh flex-col">
      <header className="border-b border-page-line">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-5 py-6">
          <BrandMark href="/" size="md" className="text-page-ink" />
          <Link
            href="/"
            className="text-sm text-page-ink-soft underline decoration-page-line underline-offset-4 transition-colors hover:text-periwinkle"
          >
            Back home
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-5 py-10 sm:py-14">
        <p className="font-display text-sm text-periwinkle">Legal</p>
        <h1 className="mt-2 font-display text-3xl font-bold text-page-ink sm:text-4xl">
          {title}
        </h1>
        <p className="mt-2 text-sm text-page-ink-soft">Last updated {updated}</p>
        <div className="legal-prose mt-8 space-y-6 text-sm leading-6 text-page-ink-soft sm:text-base sm:leading-7">
          {children}
        </div>
      </main>

      <Footer />
    </div>
  );
}

export function LegalSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section>
      <h2 className="font-display text-lg font-bold text-page-ink sm:text-xl">
        {title}
      </h2>
      <div className="mt-2 space-y-3">{children}</div>
    </section>
  );
}
