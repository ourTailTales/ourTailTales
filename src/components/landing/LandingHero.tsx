"use client";

import Image from "next/image";
import { brand } from "@/lib/brand";
import { EmailCaptureCta } from "@/components/landing/EmailCaptureCta";
import { SiteHeader } from "@/components/SiteHeader";

export function LandingHero() {
  return (
    // `pt-[env(safe-area-inset-top)]`: with `viewport-fit=cover` (set on the
    // landing page) the photo runs up under the phone's status bar instead
    // of leaving a strip of page colour there, and the content still clears it.
    <section className="relative isolate flex min-h-[min(94dvh,50rem)] w-full flex-col overflow-hidden pt-[env(safe-area-inset-top)] sm:min-h-[min(98vh,54rem)]">
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
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(115deg,rgb(31_36_51/0.98)_0%,rgb(31_36_51/0.9)_24%,rgb(31_36_51/0.72)_44%,rgb(31_36_51/0.38)_66%,rgb(31_36_51/0.12)_82%,transparent_100%),linear-gradient(180deg,rgb(31_36_51/0.52)_0%,rgb(31_36_51/0.16)_38%,transparent_62%),linear-gradient(200deg,rgb(91_104_200/0.18)_0%,transparent_42%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-[calc(42%-20px)] bg-[linear-gradient(180deg,transparent_0%,rgb(250_247_242/0.2)_28%,rgb(250_247_242/0.55)_58%,rgb(250_247_242/0.85)_82%,#faf7f2_100%)]"
      />

      <div className="relative z-10 mx-auto flex w-full max-w-[100rem] flex-1 flex-col px-5 pt-5 pb-16 sm:px-8 sm:pt-6 sm:pb-20 lg:pl-8 lg:pr-14">
        {/* In the flow rather than floated over the hero, so it takes up its
            own room and the headline can never slide up underneath it. */}
        <SiteHeader className="text-white" />

        {/* LEFT — hook + email CTA */}
        <div className="mt-12 flex max-w-5xl flex-1 flex-col justify-center sm:mt-16">
          <h1 className="animate-fade-up font-display text-[3.3rem] font-bold leading-[1.1] text-white sm:text-[3.8rem] lg:text-[6rem] lg:leading-[1.08]">
            {brand.title}
          </h1>

          <p className="animate-fade-up-delay mt-8 max-w-3xl font-cover text-2xl font-medium italic leading-8 text-white/80 sm:text-4xl sm:leading-9">
            {brand.subtitle}
          </p>

          {/* Email capture inline */}
          <div className="animate-fade-up-delay-2 mt-8 flex flex-col gap-3 sm:mt-10">
            {/* The hero's offer does not change for anybody: the field and
                the same words, signed in or not. */}
            <EmailCaptureCta
              source="hero"
              inputId="hero-email"
              buttonLabel="Get their Free Story"
              theme="dark"
              alwaysAskEmail
            />
          </div>
        </div>

      </div>
    </section>
  );
}
