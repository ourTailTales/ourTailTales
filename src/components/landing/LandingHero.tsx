import Image from "next/image";

import { brand } from "@/lib/brand";

const proof = [
  "Photos stay on your device",
  "Hardcover from $49.99",
  "Reprint if it isn’t right",
];

export function LandingHero() {
  return (
    <section className="relative w-full overflow-hidden">
      <div className="relative grid lg:grid-cols-[minmax(0,38rem)_minmax(0,1fr)] xl:grid-cols-[minmax(0,42rem)_minmax(0,1fr)] lg:items-stretch">
        <div className="flex flex-col justify-center px-5 py-12 sm:px-8 sm:py-16 lg:justify-self-end lg:py-20 lg:pl-8 lg:pr-14">
          <p className="animate-fade-up text-sm font-medium tracking-wide text-periwinkle">
            <span className="border-b-2 border-petal pb-0.5">{brand.line}</span>
          </p>
          <h1 className="animate-fade-up-delay mt-4 font-display text-4xl font-bold leading-[1.1] text-ink sm:text-5xl lg:text-6xl lg:leading-[1.06]">
            {brand.title}
          </h1>
          <p className="animate-fade-up-delay mt-5 max-w-md text-lg leading-7 text-ink-soft">
            Drop in the album. We find the chapters on your device — you keep the
            hardcover.
          </p>
          <div className="animate-fade-up-delay-2 mt-8 flex flex-wrap items-center gap-x-5 gap-y-3">
            <a
              href="#hero-book"
              className="inline-flex rounded-xl bg-periwinkle px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-periwinkle-deep"
            >
              Drop in their album
            </a>
            <a
              href="#how-it-works"
              className="text-sm font-semibold text-lavender underline decoration-petal decoration-2 underline-offset-4 transition-colors hover:text-memory-blue"
            >
              See how it works
            </a>
          </div>
          <p className="animate-fade-up-delay-2 mt-6 max-w-lg text-sm leading-6 text-ink-soft">
            {proof.join(" · ")}
          </p>
        </div>

        <figure className="relative h-[18rem] sm:h-[24rem] lg:h-auto lg:min-h-[36rem]">
          <Image
            src="/marketing/hardcover-in-hands.png"
            alt="Hands holding a square hardcover book with a golden retriever on the cover"
            fill
            priority
            sizes="(min-width: 1024px) 58vw, 100vw"
            className="animate-fade-up object-cover"
          />
        </figure>
      </div>
    </section>
  );
}
