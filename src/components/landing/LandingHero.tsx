"use client";

import Image from "next/image";
import { useState } from "react";
import type { ReactNode } from "react";

import { brand } from "@/lib/brand";
import { identifyLead, track } from "@/lib/analytics";
import { useIsAuthenticated } from "@/hooks/useIsAuthenticated";

export function LandingHero({ header }: { header?: ReactNode }) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "working" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const isAuthenticated = useIsAuthenticated();
  // TODO: useIsAuthenticated() returns false until Supabase session check is implemented

  const handleSubmit = async () => {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setStatus("error");
      setError("Please enter a valid email.");
      return;
    }
    setStatus("working");
    setError(null);
    identifyLead(email.trim());
    track("lead_captured", { source: "hero" });
    window.location.href = "/create";
  };

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
            {isAuthenticated ? (
              /* Auth-aware: signed-in users go straight to /create */
              /* TODO: useIsAuthenticated() returns false until Supabase session check is implemented */
              <a
                href="/create"
                className="inline-flex w-fit items-center gap-2 rounded-xl bg-periwinkle px-8 py-3 text-sm font-semibold text-white shadow-lift transition-colors hover:bg-periwinkle-deep"
              >
                Create your Book
                <svg aria-hidden className="h-4 w-4" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M11 3h6v6" /><path d="M17 3l-8 8" /><path d="M9 5H5a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2v-4" />
                </svg>
              </a>
            ) : (
              <>
                <div className="flex w-full max-w-md flex-col gap-2 sm:flex-row">
                  <label htmlFor="hero-email" className="sr-only">Email address</label>
                  <input
                    id="hero-email"
                    type="email"
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); setStatus("idle"); setError(null); }}
                    onKeyDown={(e) => { if (e.key === "Enter") void handleSubmit(); }}
                    placeholder="your@email.com"
                    autoComplete="email"
                    disabled={status === "working"}
                    className="flex-1 rounded-xl border border-white/40 bg-white/25 px-4 py-3 text-sm text-white placeholder:text-white/60 outline-none backdrop-blur-sm transition-colors focus:border-periwinkle focus:bg-white/30 focus:ring-2 focus:ring-periwinkle/30 disabled:opacity-60"
                  />
                  <button
                    type="button"
                    onClick={() => void handleSubmit()}
                    disabled={status === "working" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())}
                    className="group inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-periwinkle px-6 py-3 text-sm font-semibold text-white shadow-lift transition-[background-color,transform,opacity] duration-300 hover:enabled:bg-periwinkle-deep hover:enabled:translate-y-px disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {status === "working" ? "Opening…" : "Create their Book"}
                    {status !== "working" && (
                      <svg
                        aria-hidden
                        className="h-4 w-4 transition-transform duration-300 group-hover:group-enabled:translate-x-0.5"
                        viewBox="0 0 20 20"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={2}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        {/* External link / open-in-new-tab icon */}
                        <path d="M11 3h6v6" />
                        <path d="M17 3l-8 8" />
                        <path d="M9 5H5a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2v-4" />
                      </svg>
                    )}
                  </button>
                </div>
                {error && <p className="text-sm text-red-400">{error}</p>}
              </>
            )}
            <p className="text-sm text-white/50">
              Free &nbsp;·&nbsp; No credit card &nbsp;·&nbsp; Photos stay on your device
            </p>
          </div>
        </div>

      </div>
    </section>
  );
}
