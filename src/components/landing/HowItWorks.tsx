const steps = [
  {
    title: "Drop in the album",
    body: "Hundreds of photos, read on your device.",
  },
  {
    title: "We find the chapters",
    body: "Dates, places, and the keepers rise to the top.",
  },
  {
    title: "Keep it forever",
    body: "An 8.5 × 8.5 hardcover, from $49.99.",
  },
];

export function HowItWorks() {
  return (
    <section
      id="how-it-works"
      className="scroll-mt-10 mx-auto max-w-[90rem] px-5 py-16 sm:py-20"
    >
      <h2 className="font-display text-3xl text-ink sm:text-4xl">How it works</h2>
      <ol className="mt-8 grid gap-8 sm:grid-cols-3">
        {steps.map((step, index) => (
          <li key={step.title}>
            <p className="font-display text-sm text-lavender">
              <span className="text-petal">0</span>
              {index + 1}
            </p>
            <h3 className="mt-3 font-display text-xl text-ink">{step.title}</h3>
            <p className="mt-2 text-sm leading-6 text-ink-soft">{step.body}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
