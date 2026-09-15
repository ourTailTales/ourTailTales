import Image from "next/image";

import { BASE_PRICE, MIN_PHOTOS_FOR_BOOK, formatUsd } from "@/lib/pricing";

/** Display-only until paperback is for sale. Not used at checkout. */
const PAPERBACK_BASE_PRICE = 29.99;

type Product = {
  id: string;
  name: string;
  blurb: string;
  src: string;
  alt: string;
  price: number;
  comingSoon: boolean;
  figureClassName: string;
  imageClassName: string;
  features: readonly string[];
};

const hardcover: Product = {
  id: "hardcover",
  name: "Hardcover",
  blurb: "Casewrap you can keep on the shelf.",
  src: "/marketing/mockup-2.png",
  alt: "A hardcover book standing on a dresser, with a dog named Gracie on the cover",
  price: BASE_PRICE,
  comingSoon: false,
  figureClassName: "bg-[#3d342c]",
  imageClassName: "object-cover object-[center_58%]",
  features: [
    "8.5 × 8.5 in square casewrap, matte cover",
    "Custom cover with their photo, name, and years",
    "Layouts you choose: full bleed, two up, three up, or four on a page",
    "Optional Video Memory pages with a printed QR code",
    `Starts at ${MIN_PHOTOS_FOR_BOOK} photos & videos`,
  ],
};

const paperback: Product = {
  id: "paperback",
  name: "Paperback",
  blurb: "The same story in a softcover you can carry.",
  src: "/marketing/mockup-1.png",
  alt: "Square book standing slightly turned, with a dog named Gracie on the cover",
  price: PAPERBACK_BASE_PRICE,
  comingSoon: true,
  figureClassName: "bg-[#111]",
  imageClassName: "object-contain",
  features: [
    "8.5 × 8.5 in square perfect bound softcover",
    "Custom cover with their photo, name, and years",
    "The same chapters and photo layouts as the hardcover",
    "Optional Video Memory pages with a printed QR code",
    `Starts at ${MIN_PHOTOS_FOR_BOOK} photos & videos`,
  ],
};

export function ProductListing() {
  return (
    <section
      aria-labelledby="product-listing-heading"
      className="carousel-field relative w-full"
    >
      <div className="mx-auto max-w-[90rem] px-5 py-12 sm:px-8 sm:py-16">

        <div className="mt-10 grid grid-cols-1 items-start gap-8 md:grid-cols-2 lg:grid-cols-[minmax(16rem,1fr)_18rem_18rem_minmax(16rem,1fr)] lg:gap-x-8 lg:gap-y-0 xl:grid-cols-[minmax(18rem,1fr)_20rem_20rem_minmax(18rem,1fr)]">
          <ProductFigure
            product={hardcover}
            className="order-1 md:order-2"
          />
          <ProductSpecs
            product={hardcover}
            className="order-2 md:order-1"
          />
          <ProductFigure
            product={paperback}
            className="order-3"
          />
          <ProductSpecs
            product={paperback}
            className="order-4"
          />
        </div>
      </div>
    </section>
  );
}

function ProductFigure({
  product,
  className,
}: {
  product: Product;
  className: string;
}) {
  return (
    <figure
      className={`relative aspect-square overflow-hidden rounded-2xl shadow-lift ${product.figureClassName} ${className}`}
    >
      <Image
        src={product.src}
        alt={product.alt}
        fill
        sizes="(min-width: 1024px) 320px, (min-width: 768px) 45vw, 92vw"
        className={product.imageClassName}
        priority
      />
    </figure>
  );
}

function ProductSpecs({
  product,
  className,
}: {
  product: Product;
  className: string;
}) {
  return (
    <div className={className}>
      <h3
        id={`${product.id}-name`}
        className="font-display text-xl font-bold text-page-ink sm:text-2xl"
      >
        {product.name}
      </h3>
      <p className="mt-1.5 text-sm leading-6 text-page-ink-soft">
        {product.blurb}
      </p>

      <div className="mt-4 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <p className="font-display text-2xl text-page-ink sm:text-3xl">
          From {formatUsd(product.price)}
        </p>
        {product.comingSoon ? (
          <p className="text-sm font-semibold tracking-wide text-periwinkle uppercase">
            Coming soon
          </p>
        ) : null}
      </div>

      <ul className="mt-5 grid gap-2">
        {product.features.map((feature) => (
          <li
            key={feature}
            className="flex gap-2.5 text-sm leading-6 text-page-ink"
          >
            <span
              aria-hidden
              className="mt-2 size-1.5 shrink-0 rounded-full bg-periwinkle"
            />
            {feature}
          </li>
        ))}
      </ul>

      <div className="mt-6">
        {product.comingSoon ? (
          <p className="text-sm text-page-ink-faint">
            This binding is not open for orders yet.
          </p>
        ) : (
          <a
            href="#hero-book"
            className="inline-flex rounded-xl bg-periwinkle px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-periwinkle-deep"
          >
            Start this book
          </a>
        )}
      </div>
    </div>
  );
}
