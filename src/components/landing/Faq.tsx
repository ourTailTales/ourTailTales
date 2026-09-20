import {
  BASE_PRICE,
  BASE_CHAPTERS,
  MAX_CHAPTERS,
  MIN_PHOTOS_FOR_BOOK,
  PHOTOS_PER_CHAPTER_TARGET,
  PRICE_PER_EXTRA_CHAPTER,
  STORY_PAGES_PER_CHAPTER,
  formatUsd,
} from "@/lib/pricing";
import {
  VIDEO_MEMORIES_PER_PACK,
  VIDEO_MEMORY_PACK_PRICE_CENTS,
} from "@/lib/video-memory/config";

const faqs = [
  {
    question: "Where do my photos go?",
    answer:
      "They stay on your device while you build the book. Nothing is uploaded for printing until you place an order.",
  },
  {
    question: "How many photos do I need?",
    answer:
      `At least ${MIN_PHOTOS_FOR_BOOK} usable photos or videos for the hardcover. Each chapter uses ${PHOTOS_PER_CHAPTER_TARGET.min}–${PHOTOS_PER_CHAPTER_TARGET.max} photos, so a larger album can support more chapters without repeating images.`,
  },
  {
    question: "What does the book cost?",
    answer:
      `Hardcovers start at ${formatUsd(BASE_PRICE)} for ${BASE_CHAPTERS} chapters (${BASE_CHAPTERS * STORY_PAGES_PER_CHAPTER} story pages). Each additional ${STORY_PAGES_PER_CHAPTER}-page chapter is ${formatUsd(PRICE_PER_EXTRA_CHAPTER)}, up to ${MAX_CHAPTERS} chapters. Optional Video Memories are available in packs of ${VIDEO_MEMORIES_PER_PACK} QR-linked videos for ${formatUsd(VIDEO_MEMORY_PACK_PRICE_CENTS / 100)}. Paperback is coming soon.`,
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
    question: "What if I don't love the finished book?",
    answer:
      "Full refund, no questions asked. We want every copy to be one you actually want on your shelf.",
  },
  {
    question: "Can I get a free version before I pay anything?",
    answer:
      "Yes. That\'s the whole point. Enter your email on the home page, drop your photos, and we build a free PDF story right in your browser. No credit card needed. Only order the hardcover once you\'ve seen it and love it.",
  },
] as const;

export function Faq() {
  return (
    <section aria-labelledby="faq-heading" className="w-full" style={{ backgroundColor: "#faf7f2" }}>
      <div className="mx-auto max-w-[90rem] px-5 py-16 sm:px-8 sm:py-20">
        <div className="max-w-2xl">
          <h2
            id="faq-heading"
            className="font-display text-3xl text-page-ink sm:text-4xl"
          >
            Questions, answered
          </h2>
          <p className="mt-3 text-base leading-7 text-page-ink-soft">
            The short version of how the album becomes a book you can hold.
          </p>
        </div>

        <div className="mt-10 max-w-3xl divide-y divide-page-line border-t border-page-line">
          {faqs.map((faq) => (
            <details key={faq.question} className="group py-5">
              <summary className="flex cursor-pointer list-none items-start justify-between gap-4 text-left font-display text-lg text-page-ink marker:content-none [&::-webkit-details-marker]:hidden sm:text-xl">
                <span>{faq.question}</span>
                <span
                  aria-hidden
                  className="mt-1 shrink-0 text-base leading-none text-page-ink-faint transition-transform group-open:rotate-45"
                >
                  +
                </span>
              </summary>
              <p className="mt-3 max-w-2xl pr-8 text-sm leading-6 text-page-ink-soft sm:text-base sm:leading-7">
                {faq.answer}
              </p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
