import Image from "next/image";

const shots = [
  {
    src: "/marketing/hardcover-in-hands.png",
    alt: "Hands holding a square hardcover book with a golden retriever on the cover",
    label: null,
  },
  {
    src: "/marketing/open-spread-table.png",
    alt: "An open hardcover pet book on a table, with a cat photo on the right page",
    label: "A real hardcover spread",
  },
  {
    src: "/marketing/reading-together.png",
    alt: "A person and their dog looking through a printed hardcover photo book",
    label: null,
  },
];

export function ProductMockups() {
  return (
    <section aria-label="Printed hardcover" className="w-full">
      <div className="grid sm:grid-cols-2 lg:grid-cols-3">
        {shots.map((shot) => (
          <figure
            key={shot.src}
            className="relative aspect-4/3 overflow-hidden bg-memory-blue"
          >
            <Image
              src={shot.src}
              alt={shot.alt}
              fill
              sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
              className="object-cover"
            />
            {shot.label ? (
              <figcaption className="absolute bottom-3 left-3 rounded-lg bg-cloud/90 px-3 py-1.5 text-xs font-medium text-memory-blue">
                {shot.label}
              </figcaption>
            ) : null}
          </figure>
        ))}
      </div>
    </section>
  );
}
