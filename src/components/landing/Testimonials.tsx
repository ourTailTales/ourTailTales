const placeholderReviews = [
  {
    name: "[Customer name]",
    location: "[City, State]",
    quote: "[Placeholder — replace with a real customer quote before this section ships.]",
  },
  {
    name: "[Customer name]",
    location: "[City, State]",
    quote: "[Placeholder — replace with a real customer quote before this section ships.]",
  },
  {
    name: "[Customer name]",
    location: "[City, State]",
    quote: "[Placeholder — replace with a real customer quote before this section ships.]",
  },
] as const;

export function Testimonials() {
  return (
    <section aria-labelledby="testimonials-heading" className="w-full" style={{ backgroundColor: "#faf7f2" }}>
      <div className="mx-auto max-w-5xl px-5 py-16 sm:px-8 sm:py-20">
        <div className="text-center">
          <h2
            id="testimonials-heading"
            className="font-display text-3xl font-bold text-page-ink sm:text-4xl"
          >
            What pet parents are saying
          </h2>
        </div>

        {/*
          TODO(content): These are structural placeholders only — not real customer
          reviews. Do not deploy to production until each card below is replaced
          with a real name, real city/state, and a real customer quote.
        */}
        <div className="mt-12 grid gap-6 sm:grid-cols-3">
          {placeholderReviews.map((review, i) => (
            <figure
              key={i}
              className="rounded-2xl border-2 border-page-line bg-white p-6 shadow-sm"
            >
              <blockquote className="text-sm leading-6 text-page-ink-soft">
                {review.quote}
              </blockquote>
              <figcaption className="mt-4 text-sm font-semibold text-page-ink">
                {review.name}
                <span className="block font-normal text-page-ink-faint">{review.location}</span>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}
