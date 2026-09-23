import { brand } from "@/lib/brand";

/**
 * Social proof, honestly labelled.
 *
 * Real reviews exist, but not yet in a form we can publish: we need the
 * customer's own words, their rating, and a photo of them holding the book.
 * Until those arrive, these are visibly empty slots and an invitation to fill
 * them — never invented quotes under invented names. A grief-adjacent product
 * cannot afford to be caught fabricating praise, and the FTC's rule on
 * testimonials is not a style guideline.
 */

const REVIEW_EMAIL = `hello@${brand.domain}`;

const asks = [
  "A rating out of 5",
  "A sentence or three about your book",
  "A photo of you holding it",
] as const;

export function Testimonials() {
  const mailto = `mailto:${REVIEW_EMAIL}?subject=${encodeURIComponent(
    "My ourTailTales review",
  )}`;

  return (
    <section
      aria-labelledby="testimonials-heading"
      className="w-full bg-cream"
    >
      <div className="mx-auto max-w-5xl px-5 py-16 sm:px-8 sm:py-20">
        <div className="text-center">
          <h2
            id="testimonials-heading"
            className="font-display text-3xl font-bold text-page-ink sm:text-4xl"
          >
            Made a book? Tell us about it.
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-page-ink-soft">
            We would rather leave this space empty than fill it with words
            nobody said. If you have made a book, send us yours and we will put
            it here.
          </p>
        </div>

        <ul className="mt-12 grid gap-6 sm:grid-cols-3">
          {asks.map((ask) => (
            <li
              key={ask}
              className="flex min-h-40 flex-col justify-between rounded-2xl border-2 border-dashed border-page-line bg-white/60 p-6"
            >
              <p
                aria-hidden
                className="font-display text-4xl leading-none text-page-line"
              >
                &ldquo;
              </p>
              <p className="mt-4 text-sm leading-6 text-page-ink-faint">
                {ask}
              </p>
            </li>
          ))}
        </ul>

        <div className="mt-10 text-center">
          <a
            href={mailto}
            className="inline-flex min-h-11 items-center justify-center rounded-xl bg-periwinkle px-6 py-3 text-sm font-semibold text-white shadow-lift hover:bg-periwinkle-deep"
          >
            Send us your review
          </a>
          <p className="mt-3 text-xs text-page-ink-faint">
            Email {REVIEW_EMAIL}. We will ask before we publish anything.
          </p>
        </div>
      </div>
    </section>
  );
}
