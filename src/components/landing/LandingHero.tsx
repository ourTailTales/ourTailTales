"use client";

import Image from "next/image";
import type { ReactNode } from "react";

import { brand } from "@/lib/brand";
import { EmailCaptureCta } from "@/components/landing/EmailCaptureCta";

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
        className="pointer-events-none absolute inset-x-0 bottom-0 h-[calc(42%-20px)] bg-[linear-gradient(180deg,transparent_0%,rgb(250_247_242/0.2)_28%,rgb(250_247_242/0.55)_58%,rgb(250_247_242/0.85)_82%,#faf7f2_100%)]"
      />

      <div className="relative z-10 mx-auto grid w-full max-w-[100rem] flex-1 items-center px-5 pt-10 pb-16 sm:px-8 sm:pt-14 sm:pb-20 lg:pl-8 lg:pr-14">

        {/* LEFT — hook + email CTA */}
        <div className="flex flex-col max-w-5xl">
          <div className="mb-8">{header}</div>

          <h1 className="animate-fade-up font-display text-[2.8rem] font-bold leading-[1.1] text-white sm:text-[3.8rem] lg:text-[6rem] lg:leading-[1.08]">
            {brand.title}
          </h1>

          <p className="animate-fade-up-delay mt-4 max-w-lg font-cover text-xl font-medium italic leading-8 text-white/80 sm:text-2xl sm:leading-9">
            {brand.subtitle}
          </p>

          {/* Email capture inline */}
          <div className="animate-fade-up-delay-2 mt-8 flex flex-col gap-3 sm:mt-10">
            <EmailCaptureCta
              source="hero"
              inputId="hero-email"
              buttonLabel="Get their Free Story"
              theme="dark"
            />
            <p className="text-sm text-white/50">
              Free &nbsp;·&nbsp; No credit card &nbsp;·&nbsp; Photos stay on your device
            </p>
          </div>
        </div>

      </div>
    </section>
  );
}
