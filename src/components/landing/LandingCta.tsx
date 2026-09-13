import Image from "next/image";

export function LandingCta() {
  return (
    <section className="relative overflow-hidden">
      <div className="relative mx-auto grid max-w-[90rem] items-center gap-10 px-5 py-16 sm:py-20 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="text-center lg:text-left">
          <h2 className="font-display text-3xl text-ink sm:text-4xl">
            Their life, in chapters.
          </h2>
          <p className="mx-auto mt-3 max-w-md text-base leading-7 text-ink-soft lg:mx-0">
            Drop in the album. You keep the book.
          </p>
          <a
            href="#hero-book"
            className="mt-8 inline-flex rounded-xl bg-periwinkle px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-periwinkle-deep"
          >
            Drop in their album
          </a>
        </div>
        <figure className="relative mx-auto aspect-4/3 w-full max-w-sm overflow-hidden rounded-2xl bg-memory-blue shadow-book lg:mx-0">
          <Image
            src="/marketing/reading-together.png"
            alt="A person and their dog looking through a printed hardcover photo book"
            fill
            sizes="(min-width: 1024px) 18rem, 24rem"
            className="object-cover"
          />
        </figure>
      </div>
    </section>
  );
}
