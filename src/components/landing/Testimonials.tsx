const placeholderReviews = [
  {
    name: "Sarah A.",
    location: "Boston, MA",
    quote: "The book is high quality, and they got my Leila's memories drawn in such a nice way!",
  },
  {
    name: "Emma L.",
    location: "Boston, MA",
    quote: "I love the idea of this book! It's a great way to capture your pet's personality and memories.",
  },
  {
    name: "John D.",
    location: "Boston, MA",
    quote: "This is a great way to capture your pet's personality and memories.",
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
              className="rounded-2xl border-2 border-page-line bg-white p-6 shadow-sm italic"
            >
              <blockquote className="text-sm leading-6 text-page-ink-soft">
                &quot;{review.quote}&quot;
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
