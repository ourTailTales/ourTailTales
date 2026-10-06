import { EmailCaptureCta } from "@/components/landing/EmailCaptureCta";
import { TEASER_PAGE_COUNT } from "@/lib/book/teaser";
import { DRAFT_TTL_DAYS } from "@/lib/drafts/expiry";
import {
  BASE_PRICE,
  BASE_CHAPTERS,
  CHAPTER_TIERS,
  EXTRA_COPY_DISCOUNT,
  MIN_PHOTOS_FOR_BOOK,
  MAX_STORY_PAGES_PER_CHAPTER,
  MIN_STORY_PAGES_PER_CHAPTER,
  PHOTOS_PER_CHAPTER_TARGET,
  formatUsd,
} from "@/lib/pricing";
import {
  VIDEO_MEMORIES_PER_PACK,
  VIDEO_MEMORY_PACK_PRICE_CENTS,
} from "@/lib/video-memory/config";
import { videoMemoriesEnabled } from "@/lib/video-memory/flag";

const EXTRA_COPY_PERCENT = Math.round(EXTRA_COPY_DISCOUNT * 100);

/** "$4.99 each for chapters 6 to 12 and $3.99 each for chapters 13 to 50". */
const extraChapterRates = CHAPTER_TIERS.filter((tier) => tier.ratePerChapter > 0)
  .map(
    (tier) =>
      `${formatUsd(tier.ratePerChapter)} each for chapters ${tier.fromChapter} to ${tier.toChapter}`,
  )
  .join(" and ");

/** Video Memory copy only appears while `VIDEO_MEMORIES_ENABLED` is on. */
const buildFaqs = (videoMemories: boolean) => [
  {
    question: "Where do my photos go?",
    answer:
      `Your original photos are read on your own device. Small previews of them are sent to us to write the story. Your preview link works for ${DRAFT_TTL_DAYS} days. A free account saves the book to your library. The full print files are uploaded when you order.`,
  },
  {
    question: "How many photos do I need?",
    answer:
      `At least ${MIN_PHOTOS_FOR_BOOK} usable ${videoMemories ? "photos or videos" : "photos"} for the hardcover. Each chapter uses ${PHOTOS_PER_CHAPTER_TARGET.min} to ${PHOTOS_PER_CHAPTER_TARGET.max} photos, so a larger album can fill more chapters without repeating images.`,
  },
  {
    question: "What does the book cost?",
    answer:
      `${formatUsd(BASE_PRICE)} covers the hardcover and its first ${BASE_CHAPTERS} chapters. Extra chapters are ${extraChapterRates}. Every chapter runs ${MIN_STORY_PAGES_PER_CHAPTER} to ${MAX_STORY_PAGES_PER_CHAPTER} pages. Shipping is added at checkout, and we ship within the United States. Extra copies of the same book are ${EXTRA_COPY_PERCENT}% off.${
        videoMemories
          ? ` Optional Video Memories come in packs of ${VIDEO_MEMORIES_PER_PACK} QR-linked videos for ${formatUsd(VIDEO_MEMORY_PACK_PRICE_CENTS / 100)}.`
          : ""
      }`,
  },
  {
    question: "Can I edit the story?",
    answer:
      "Yes. After we draft the chapters from your album, you can change titles, opening words, photo order, and the cover photo before you order.",
  },
  ...(videoMemories
    ? [
        {
          question: "What is a Video Memory?",
          answer:
            "A short video you place in the book. In print it appears as a page with a QR code so you can watch that moment again from your phone.",
        },
      ]
    : []),
  {
    question: "What if my book arrives damaged or misprinted?",
    answer:
      "Email us within 30 days of delivery with a photo. We reprint it and send a new copy at no cost. You can read the whole book before you order, so the reprint covers printing and shipping damage, not changes to the story.",
  },
  {
    question: "Can I get a free version before I pay anything?",
    answer:
      `Yes. Enter your email on the home page and add your photos, and we build a free preview of the story in minutes. The first ${TEASER_PAGE_COUNT} pages are free. The whole book opens with a free account. No credit card needed. Only order the hardcover once you have read it and love it.`,
  },
] as const;

export function Faq() {
  const faqs = buildFaqs(videoMemoriesEnabled());
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

        <div className="mt-14 flex flex-col items-center gap-2">
          <EmailCaptureCta
            source="faq"
            inputId="faq-email"
            buttonLabel="Get their Free Story"
            inputWidthClassName="flex-[4]"
            theme="light"
          />
        </div>
      </div>
    </section>
  );
}
