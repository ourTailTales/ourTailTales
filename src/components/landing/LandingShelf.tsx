import Image from "next/image";
import type { ReactNode } from "react";

import "./landing-shelf.css";

/** Landing-only stage: hardcover on the bookcase cap. */
export function LandingShelf({ book }: { book: ReactNode }) {
  return (
    <section className="landing-shelf relative isolate">
      <div className="relative z-20 mx-auto max-w-[90rem] px-5 pt-2 sm:pt-4">
        {book}
      </div>

      <div className="landing-shelf__case relative z-10 mx-auto -mt-3 sm:-mt-3.5 md:-mt-4">
        <div className="landing-shelf__stage">
          <Image
            src="/landing_page/shelf-2.png"
            alt=""
            fill
            priority
            sizes="100vw"
            className="object-contain object-top"
          />
          <div aria-hidden className="landing-shelf__contact" />
        </div>
      </div>
    </section>
  );
}
