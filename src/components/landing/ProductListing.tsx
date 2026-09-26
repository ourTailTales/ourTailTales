import Image from "next/image";

import { EmailCaptureCta } from "@/components/landing/EmailCaptureCta";
import {
  BASE_CHAPTERS,
  BASE_PRICE,
  CHAPTER_TIERS,
  MAX_STORY_PAGES_PER_CHAPTER,
  MIN_PHOTOS_FOR_BOOK,
  MIN_STORY_PAGES_PER_CHAPTER,
  PHOTOS_PER_CHAPTER_TARGET,
  bookPrice,
  formatUsd,
  type ChapterTier,
} from "@/lib/pricing";

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
            <p className="mt-1 text-sm text-page-ink-soft">
              Starting price · {BASE_CHAPTERS} chapters · no hidden fees
            </p>

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

        {/* What a longer book costs, in full, before anybody is asked for an
            email. Chapters are billed band by band, so this table is the
            whole price list rather than a teaser for one. */}
        <div className="mt-14">
          <h3 className="font-display text-2xl font-bold text-page-ink">
            Priced by the chapter
          </h3>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-page-ink-soft">
            The longer their story runs, the less each chapter costs. Every rate below
            applies only to the chapters inside its band — a twelve-chapter book pays the
            Keepsake rate on its first nine and the Chronicle rate on the three after
            that. A chapter holds the same amount whichever band it falls in.
          </p>

          <ul className="mt-6 grid gap-4 sm:grid-cols-3">
            {CHAPTER_TIERS.map((tier) => (
              <TierCard key={tier.id} tier={tier} />
            ))}
          </ul>

          <p className="mt-4 text-xs leading-5 text-page-ink-soft">
            Shipping and tax are quoted at checkout against your real address. Your
            invoice shows each band and the rate it was charged at.
          </p>
        </div>

        <div className="mt-10 flex flex-col items-center gap-2">
          <EmailCaptureCta
            source="product_listing"
            inputId="product-listing-email"
            buttonLabel="Get their Free Story"
            inputWidthClassName="flex-[4]"
            theme="light"
          />
        </div>
      </div>
    </section>
  );
}

/**
 * One band of the price list.
 *
 * The chapter range and the rate are the offer; the photo and page counts are
 * there because they are the first thing anybody asks next, and they are the
 * same on all three cards on purpose — the bands buy length, not a richer
 * chapter.
 */
function TierCard({ tier }: { tier: ChapterTier }) {
  const shortest = Math.max(tier.fromChapter, BASE_CHAPTERS);
  const facts = [
    `${shortest}\u2013${tier.toChapter} chapters`,
    `${PHOTOS_PER_CHAPTER_TARGET.min}\u2013${PHOTOS_PER_CHAPTER_TARGET.max} photos per chapter`,
    `${MIN_STORY_PAGES_PER_CHAPTER}\u2013${MAX_STORY_PAGES_PER_CHAPTER} printed pages per chapter`,
  ];

  return (
    <li className="flex flex-col rounded-2xl border border-page-line bg-white p-5 shadow-lift">
      <p className="font-display text-lg font-bold text-page-ink">{tier.name}</p>
      {/* Two lines' worth whether it needs them or not, so the three prices
          sit on one line across the row. */}
      <p className="mt-1 min-h-12 text-sm leading-6 text-page-ink-soft">{tier.blurb}</p>

      <p className="mt-4 flex items-baseline gap-1.5">
        <span className="font-display text-3xl font-bold text-page-ink">
          {formatUsd(tier.ratePerChapter)}
        </span>
        <span className="text-sm text-page-ink-soft">per chapter</span>
      </p>

      <ul className="mt-4 grid gap-2 pb-4">
        {facts.map((fact) => (
          <li key={fact} className="flex gap-2.5 text-sm leading-6 text-page-ink">
            <span
              aria-hidden
              className="mt-[9px] size-1.5 shrink-0 rounded-full bg-periwinkle/80"
            />
            {fact}
          </li>
        ))}
      </ul>

      <p className="mt-auto border-t border-page-line pt-3 text-sm text-page-ink-soft">
        A whole book in this band:{" "}
        <span className="font-semibold text-page-ink">
          {formatUsd(bookPrice(shortest))}&ndash;{formatUsd(bookPrice(tier.toChapter))}
        </span>
      </p>
    </li>
  );
}
