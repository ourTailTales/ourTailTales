import {
  BASE_PRICE,
  MAX_CHAPTERS,
  MIN_PHOTOS_FOR_BOOK,
  PRICE_PER_EXTRA_CHAPTER,
  formatUsd,
} from "@/lib/pricing";

const faqs = [
  {
    question: "Where do my photos go?",
    answer:
      "They stay on your device while you build the book. Nothing is uploaded for printing until you place an order.",
  },
  {
    question: "How many photos do I need?",
    answer:
      `At least ${MIN_PHOTOS_FOR_BOOK} usable photos or videos for the hardcover. More of their album fills the chapters without stretching the same images.`,
  },
  {
    question: "What does the book cost?",
    answer:
      `Hardcovers start at ${formatUsd(BASE_PRICE)} for 10 chapters. Extra chapters are ${formatUsd(PRICE_PER_EXTRA_CHAPTER)} each, up to ${MAX_CHAPTERS}. Optional Video Memories are available as an add-on. Paperback is coming soon.`,
  },
  {
    question: "Can I edit the story?",
    answer:
      "Yes. After we draft the chapters from your album, you can change titles, opening words, photo order, and the cover photo before you order.",
  },
  {
    question: "What is a Video Memory?",
    answer:
      "A short video you place in the book. In print it appears as a page with a QR code so you can watch that moment again from your phone.",
  },
  {
    question: "Can I see a sample before I order?",
    answer:
      "Yes. Email yourself a free PDF sample from the editor once your chapters are ready, or preview the hardcover layout on screen.",
  },
] as const;

export function Faq() {
  return (
    <section aria-labelledby="faq-heading" className="w-full">
      <div className="mx-auto max-w-[90rem] px-5 py-16 sm:px-8 sm:py-20">
        <div className="max-w-2xl">
          <h2
            id="faq-heading"
            className="font-display text-3xl text-ink sm:text-4xl"
          >
            Questions, answered
          </h2>
          <p className="mt-3 text-base leading-7 text-ink-soft">
            The short version of how the album becomes a book you can hold.
          </p>
        </div>

        <div className="mt-10 max-w-3xl divide-y divide-line border-t border-line">
          {faqs.map((faq) => (
            <details key={faq.question} className="group py-5">
              <summary className="flex cursor-pointer list-none items-start justify-between gap-4 text-left font-display text-lg text-ink marker:content-none [&::-webkit-details-marker]:hidden sm:text-xl">
                <span>{faq.question}</span>
                <span
                  aria-hidden
                  className="mt-1 shrink-0 text-base leading-none text-ink-faint transition-transform group-open:rotate-45"
                >
                  +
                </span>
              </summary>
              <p className="mt-3 max-w-2xl pr-8 text-sm leading-6 text-ink-soft sm:text-base sm:leading-7">
                {faq.answer}
              </p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
