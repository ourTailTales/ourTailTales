import Image from "next/image";

import { BASE_PRICE, MIN_PHOTOS_FOR_BOOK, formatUsd } from "@/lib/pricing";

const hardcoverFeatures = [
  "8.5 × 8.5 in square casewrap, matte cover",
  "Custom cover with their photo, name, and years",
  "Layouts you choose: full bleed, two up, three up, or four on a page",
  "Optional Video Memory pages with a printed QR code",
  `Starts at ${MIN_PHOTOS_FOR_BOOK} photos & videos`,
] as const;

export function ProductListing() {
  return (
    <section aria-labelledby="hardcover-heading" className="relative w-full" style={{ backgroundColor: "#faf7f2" }}>
      {/* Dot grid pattern overlay */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.08) 1px, transparent 1px)",
          backgroundSize: "24px 24px",
        }}
      />
      <div className="relative mx-auto max-w-5xl px-5 py-16 sm:px-8 sm:py-20">

        {/* Upgrade framing — not a spec sheet */}
        <div className="mb-10">
          <p className="text-sm font-semibold uppercase tracking-widest text-periwinkle">
            Ready to hold it in your hands?
          </p>
          <h2
            id="hardcover-heading"
            className="mt-2 font-display text-3xl font-bold text-page-ink sm:text-4xl"
          >
            Love the free PDF? Order the hardcover.
          </h2>
          <p className="mt-3 max-w-xl text-base leading-7 text-page-ink-soft">
            The same story, printed, bound, and sitting on your shelf forever. A real book
            with their face on the cover.
          </p>
        </div>

        <div className="grid items-center gap-8 md:grid-cols-[minmax(15rem,0.9fr)_minmax(19rem,1.1fr)] md:gap-12">
          <div className="min-w-0">
            <p className="font-display text-3xl font-bold text-page-ink sm:text-4xl">
              {formatUsd(BASE_PRICE)}
            </p>
            <p className="mt-1 text-sm text-page-ink-soft">Starting price · no hidden fees</p>

            <p className="mt-3 inline-flex items-center gap-2 rounded-full bg-periwinkle/10 px-3.5 py-1.5 text-sm font-semibold text-periwinkle-deep">
              <span aria-hidden>✓</span>
              Free reprint if it arrives damaged or misprinted
            </p>

            <p className="mt-6 text-sm font-semibold text-page-ink">Here&rsquo;s everything included:</p>
            <ul className="mt-3 grid gap-3">
              {hardcoverFeatures.map((feature) => (
                <li key={feature} className="flex gap-2.5 text-sm leading-6 text-page-ink">
                  <span aria-hidden className="mt-[7px] size-1.5 shrink-0 rounded-full bg-periwinkle/80" />
                  {feature}
                </li>
              ))}
            </ul>
          </div>

          <figure className="relative aspect-square overflow-hidden rounded-2xl bg-[#3d342c] shadow-lift">
            <Image
              src="/marketing/mockup-2.png"
              alt="A hardcover pet memoir book standing on a dresser, with a dog named Gracie on the cover"
              fill
              sizes="(min-width: 768px) 44vw, 90vw"
              className="object-cover object-[center_58%]"
            />
          </figure>
        </div>
      </div>
    </section>
  );
}
