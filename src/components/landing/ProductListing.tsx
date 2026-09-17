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
    <section aria-labelledby="hardcover-heading" className="relative w-full">
      <div className="mx-auto grid max-w-5xl items-center gap-7 px-5 py-10 sm:px-8 sm:py-14 md:grid-cols-[minmax(15rem,0.9fr)_minmax(19rem,1.1fr)] md:gap-12">
        <div className="min-w-0">
          <h2 id="hardcover-heading" className="font-display text-3xl font-bold text-page-ink sm:text-4xl">
            Hardcover
          </h2>

          <p className="mt-4 font-display text-2xl text-page-ink sm:text-3xl">
            {formatUsd(BASE_PRICE)}
          </p>

          <ul className="mt-5 grid gap-2">
            {hardcoverFeatures.map((feature) => (
              <li key={feature} className="flex gap-2.5 text-sm leading-6 text-page-ink">
                <span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-periwinkle" />
                {feature}
              </li>
            ))}
          </ul>

          <div className="mt-6">
            <a
              href="#create-free-book"
              className="inline-flex rounded-xl bg-periwinkle px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-periwinkle-deep"
            >
              Start this book
            </a>
          </div>
        </div>

        <figure className="relative aspect-square overflow-hidden rounded-2xl bg-[#3d342c] shadow-lift">
          <Image
            src="/marketing/mockup-2.png"
            alt="A hardcover book standing on a dresser, with a dog named Gracie on the cover"
            fill
            sizes="(min-width: 768px) 44vw, 90vw"
            className="object-cover object-[center_58%]"
            priority
          />
        </figure>
      </div>
    </section>
  );
}
