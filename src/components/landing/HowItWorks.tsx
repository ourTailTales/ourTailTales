"use client";

import Image from "next/image";
import type { ReactElement } from "react";

import { EmailCaptureCta } from "@/components/landing/EmailCaptureCta";

const steps = [
  {
    title: "Send their photos & videos",
    description: "Camera roll, Google Photos, iCloud. Any album, any order.",
    icon: "upload",
  },
  {
    title: "We write their story",
    description: "Organized into chapters, written with love. Ready in minutes.",
    icon: "logo",
  },
  {
    title: "Get the free PDF",
    description: "Delivered straight to your inbox. No cost, no card.",
    icon: "pdf",
  },
] as const;

function StepIcon({ icon }: { icon: (typeof steps)[number]["icon"] }) {
  if (icon === "logo") {
    return (
      <Image
        src="/branding/logo-512.png"
        alt=""
        width={36}
        height={36}
        className="h-9 w-9 object-contain"
      />
    );
  }

  const paths: Record<string, ReactElement> = {
    upload: (
      <>
        <path d="M12 16V4" />
        <path d="M7 9l5-5 5 5" />
        <path d="M4 16v3a2 2 0 002 2h12a2 2 0 002-2v-3" />
      </>
    ),
    pdf: (
      <>
        <path d="M14 2H7a2 2 0 00-2 2v16a2 2 0 002 2h10a2 2 0 002-2V8z" />
        <path d="M14 2v6h6" />
        <path d="M9.5 15.5h1a1.5 1.5 0 000-3h-1v4.5" />
        <path d="M13.5 12.5v4.5" />
        <path d="M13.5 14.5H15.5" />
      </>
    ),
  };

  return (
    <svg
      aria-hidden
      className="h-9 w-9 text-periwinkle"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {paths[icon]}
    </svg>
  );
}

export function HowItWorks() {
  return (
    <section aria-labelledby="how-heading" className="w-full" style={{ backgroundColor: "#faf7f2" }}>
      <div className="mx-auto max-w-6xl px-5 py-16 sm:px-8 sm:py-20">
        <div className="text-center">
          <h2
            id="how-heading"
            className="font-display text-3xl font-bold text-page-ink sm:text-4xl"
          >
            How it works
          </h2>
        </div>

        {/* Flow graphic */}
        <div className="relative mt-16">
          {/* Connecting line (desktop) - spans only between node centers */}
          <div
            aria-hidden
            className="pointer-events-none absolute top-9 hidden h-px bg-[repeating-linear-gradient(90deg,var(--color-periwinkle)_0,var(--color-periwinkle)_8px,transparent_8px,transparent_16px)] opacity-60 sm:block"
            style={{
              left: "calc(100% / 6)",
              right: "calc(100% / 6)",
            }}
          />

          <ol className="relative grid grid-cols-1 gap-y-12 sm:grid-cols-3 sm:gap-x-6 sm:gap-y-0">
            {steps.map((step, i) => (
              <li key={step.title} className="relative flex flex-col items-center text-center">
                {/* Node */}
                <div className="relative z-10 flex h-[4.5rem] w-[4.5rem] items-center justify-center rounded-full border-2 border-periwinkle/50 bg-periwinkle/5 shadow-sm">
                  <StepIcon icon={step.icon} />
                </div>

                {/* Arrow to next step (mobile only) */}
                {i < steps.length - 1 && (
                  <svg
                    aria-hidden
                    className="my-3 h-6 w-6 text-periwinkle/40 sm:hidden"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.75}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M12 5v14" />
                    <path d="M6 13l6 6 6-6" />
                  </svg>
                )}

                <h3 className="mt-4 font-display text-lg font-bold text-page-ink">
                  {step.title}
                </h3>
                <p className="mt-2 max-w-[15rem] text-sm leading-6 text-page-ink-soft">
                  {step.description}
                </p>
              </li>
            ))}
          </ol>
        </div>

        {/* Email capture CTA */}
        <div className="mt-14 flex flex-col items-center gap-2">
          <EmailCaptureCta
            source="how_it_works"
            inputId="how-it-works-email"
            buttonLabel="Get their Free Story"
            inputWidthClassName="flex-[4]"
            theme="light"
          />
        </div>
      </div>
    </section>
  );
}
