import Image from "next/image";
import type { ReactNode } from "react";

import { brand } from "@/lib/brand";

export function LandingHero({ header }: { header?: ReactNode }) {
  return (
    <section className="relative isolate flex min-h-[min(94vh,50rem)] w-full flex-col overflow-hidden sm:min-h-[min(98vh,54rem)]">
      <Image
        src="/marketing/banner-2.png"
        alt=""
        fill
        priority
        sizes="100vw"
        className="object-cover object-[center_42%]"
      />
      <div
        aria-hidden
        className="absolute inset-0 bg-[linear-gradient(115deg,rgb(31_36_51/0.98)_0%,rgb(31_36_51/0.9)_24%,rgb(31_36_51/0.72)_44%,rgb(31_36_51/0.38)_66%,rgb(31_36_51/0.12)_82%,transparent_100%),linear-gradient(180deg,rgb(31_36_51/0.52)_0%,rgb(31_36_51/0.16)_38%,transparent_62%),linear-gradient(200deg,rgb(91_104_200/0.18)_0%,transparent_42%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-[calc(42%-20px)] bg-[linear-gradient(180deg,transparent_0%,rgb(226_215_245/0.2)_28%,rgb(226_215_245/0.55)_58%,rgb(226_215_245/0.85)_82%,var(--color-carousel-field)_100%)]"
      />

      <div className="relative z-10 mx-auto flex w-full max-w-[90rem] flex-1 flex-col px-5 pt-10 sm:px-8 sm:pt-14 lg:pl-8 lg:pr-14">
        <div className="w-fit">{header}</div>
        <div className="mt-10 max-w-md sm:mt-12 lg:mt-16 lg:max-w-4xl">
          <h1 className="animate-fade-up font-display text-[5rem] font-bold leading-[1.12] text-ink sm:text-[9rem] lg:text-[9rem] lg:leading-[1.06]">
            {brand.title}
          </h1>
          <p className="animate-fade-up-delay mt-4 max-w-xl font-cover text-lg font-medium italic leading-8 text-ink-soft sm:text-xl sm:leading-9">
            {brand.subtitle}
          </p>
          <a
            href="#hero-book"
            className="animate-fade-up-delay-2 group mt-8 inline-flex items-center gap-2 rounded-xl bg-periwinkle px-6 py-3 text-sm font-semibold text-white shadow-lift transition-[background-color,transform] duration-300 hover:bg-periwinkle-deep hover:translate-y-px sm:mt-10 sm:text-base"
          >
            Create their story
            <span
              aria-hidden
              className="inline-block transition-transform duration-300 group-hover:translate-x-1"
            >
              →
            </span>
          </a>
        </div>
        <div className="mt-auto" />
      </div>
    </section>
  );
}
