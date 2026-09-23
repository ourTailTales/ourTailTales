"use client";

import { useEffect, useRef, useState } from "react";

import { possessivePetName } from "@/lib/book/pagination";
import { press, reveal } from "@/lib/motion";
import { useReveal } from "@/lib/motion/useReveal";
import { useOurTailTalesStore } from "@/store/useOurTailTalesStore";

/**
 * The four things we cannot get from the photographs.
 *
 * Every chapter in the book is written from this plus the album, and a model
 * looking at four compressed thumbnails cannot tell a whippet from a
 * greyhound, cannot read a name off a collar, and cannot know whether the
 * animal in them is asleep upstairs or buried in the garden. Asked here rather
 * than guessed, because getting any of them wrong in a book about someone's
 * pet is the kind of mistake that cannot be edited away afterwards.
 *
 * Only the name is required. Everything else improves the writing and none of
 * it blocks anyone, which is the whole trade: one short screen of taps in
 * exchange for a book that is recognisably about their animal.
 */

const SPECIES = ["Dog", "Cat"] as const;

export function PetIntake({ onDone }: { onDone: () => void }) {
  const meta = useOurTailTalesStore((state) => state.meta);
  const setMeta = useOurTailTalesStore((state) => state.setMeta);

  const [otherOpen, setOtherOpen] = useState(
    Boolean(meta.species) &&
      !SPECIES.some((s) => s.toLowerCase() === meta.species?.toLowerCase()),
  );
  const [attempted, setAttempted] = useState(false);

  const form = useReveal<HTMLFormElement>("intake", { gap: 70 });

  const name = meta.petName.trim();
  const stillHere = meta.stillHere;
  const chosenSpecies = meta.species?.toLowerCase();

  const submit = (): void => {
    setAttempted(true);
    if (!name) return;
    onDone();
  };

  return (
    <div className="mx-auto flex min-h-[60dvh] w-full max-w-lg flex-col justify-center py-8">
      <h1 className="font-display text-3xl leading-tight text-page-ink">
        Who is the book about?
      </h1>
      <p className="mt-2 text-sm leading-6 text-page-ink-soft">
        We write every chapter from these and your photos.
        It takes about thirty seconds.
      </p>

      <NameEcho name={name} />

      <form
        ref={form}
        className="mt-5 space-y-6"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <div data-reveal>
          <label
            htmlFor="petName"
            className="block text-sm font-medium text-page-ink"
          >
            Their name
          </label>
          <input
            id="petName"
            type="text"
            autoComplete="off"
            value={meta.petName}
            onChange={(event) => setMeta({ petName: event.target.value.slice(0, 60) })}
            placeholder="Biscuit"
            aria-invalid={attempted && !name}
            className="mt-1.5 min-h-12 w-full rounded-xl border border-page-line bg-white px-3.5 text-base text-page-ink outline-none transition-colors placeholder:text-page-ink-faint focus:border-periwinkle focus:ring-2 focus:ring-periwinkle/20"
          />
          {attempted && !name ? (
            <p role="alert" className="mt-1.5 text-xs text-red-600">
              We need their name. It goes on the cover.
            </p>
          ) : null}
        </div>

        <div data-reveal>
          <span className="block text-sm font-medium text-page-ink">
            What are they?
          </span>
          <div className="mt-2 flex flex-wrap gap-2">
            {SPECIES.map((option) => (
              <Chip
                key={option}
                label={option}
                active={!otherOpen && chosenSpecies === option.toLowerCase()}
                onClick={() => {
                  setOtherOpen(false);
                  setMeta({ species: option.toLowerCase() });
                }}
              />
            ))}
            <Chip
              label="Something else"
              active={otherOpen}
              onClick={() => {
                setOtherOpen(true);
                setMeta({ species: "" });
              }}
            />
          </div>
          {otherOpen ? (
            <Arriving>
            <input
              type="text"
              value={meta.species ?? ""}
              onChange={(event) => setMeta({ species: event.target.value.slice(0, 40) })}
              placeholder="Rabbit, horse, parrot"
              aria-label="What kind of animal"
              className="mt-2 min-h-11 w-full rounded-xl border border-page-line bg-white px-3.5 text-sm text-page-ink outline-none transition-colors placeholder:text-page-ink-faint focus:border-periwinkle focus:ring-2 focus:ring-periwinkle/20"
            />
            </Arriving>
          ) : null}
        </div>

        <div data-reveal>
          <span className="block text-sm font-medium text-page-ink">
            Are they still with you?
          </span>
          <div className="mt-2 flex flex-wrap gap-2">
            <Chip
              label="Yes, still here"
              active={stillHere === true}
              onClick={() => setMeta({ stillHere: true, deathYear: "" })}
            />
            <Chip
              label="No, they've passed"
              active={stillHere === false}
              onClick={() => setMeta({ stillHere: false })}
            />
          </div>

          {stillHere !== undefined ? (
            <Arriving className="mt-3 grid grid-cols-2 gap-3">
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium text-page-ink-soft">
                  Year they were born
                </span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={meta.birthYear}
                  onChange={(event) =>
                    setMeta({ birthYear: digitsOnly(event.target.value) })
                  }
                  placeholder="2011"
                  className="min-h-11 w-full rounded-xl border border-page-line bg-white px-3.5 text-sm text-page-ink outline-none transition-colors placeholder:text-page-ink-faint focus:border-periwinkle focus:ring-2 focus:ring-periwinkle/20"
                />
              </label>
              {stillHere === false ? (
                <label className="block">
                  <span className="mb-1.5 block text-xs font-medium text-page-ink-soft">
                    Year they passed
                  </span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={meta.deathYear}
                    onChange={(event) =>
                      setMeta({ deathYear: digitsOnly(event.target.value) })
                    }
                    placeholder="2024"
                    className="min-h-11 w-full rounded-xl border border-page-line bg-white px-3.5 text-sm text-page-ink outline-none transition-colors placeholder:text-page-ink-faint focus:border-periwinkle focus:ring-2 focus:ring-periwinkle/20"
                  />
                </label>
              ) : null}
            </Arriving>
          ) : null}
        </div>

        <div data-reveal>
          <label htmlFor="petNotes" className="block text-sm font-medium text-page-ink">
            Anything we should know about {name || "them"}?
          </label>
          <input
            id="petNotes"
            type="text"
            value={meta.notes ?? ""}
            onChange={(event) => setMeta({ notes: event.target.value.slice(0, 240) })}
            placeholder="Terrified of the vacuum. Would swim in anything."
            className="mt-1.5 min-h-11 w-full rounded-xl border border-page-line bg-white px-3.5 text-sm text-page-ink outline-none transition-colors placeholder:text-page-ink-faint focus:border-periwinkle focus:ring-2 focus:ring-periwinkle/20"
          />
          <p className="mt-1.5 text-xs text-page-ink-faint">
            Optional. This is usually what makes the book sound like them.
          </p>
        </div>

        <button
          type="submit"
          data-reveal
          className="inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-periwinkle px-6 text-base font-semibold text-white shadow-lift transition-colors hover:bg-periwinkle-deep"
        >
          Next: add their photos
        </button>
      </form>
    </div>
  );
}

function Chip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={(event) => {
        press(event.currentTarget);
        onClick();
      }}
      aria-pressed={active}
      className={`min-h-11 rounded-xl border px-4 text-sm font-medium transition-colors ${
        active
          ? "border-periwinkle bg-periwinkle text-white"
          : "border-page-line bg-white text-page-ink-soft hover:border-periwinkle hover:text-periwinkle-deep"
      }`}
    >
      {label}
    </button>
  );
}

/** Years only — a date picker for a birth year nobody is certain of is worse. */
function digitsOnly(value: string): string {
  return value.replace(/\D/g, "").slice(0, 4);
}

/**
 * The name, said back to them.
 *
 * The one thing on this screen we cannot get wrong is the spelling of the
 * name, because it is going on a cover and onto a printed book. Showing it
 * back in the cover face, the moment there is something to show, is a
 * proofread nobody has to be asked to do.
 */
function NameEcho({ name }: { name: string }) {
  const ref = useRef<HTMLParagraphElement>(null);
  const shown = useRef(false);

  useEffect(() => {
    if (!name || shown.current) return;
    shown.current = true;
    reveal(ref.current, { distance: 8 });
  }, [name]);

  if (!name) return null;
  return (
    <p
      ref={ref}
      className="mt-4 font-cover text-lg text-periwinkle-deep opacity-0"
    >
      {possessivePetName(name)} book
    </p>
  );
}

/** A block that eases itself in when an answer opens it up. */
function Arriving({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    reveal(ref.current, { distance: 8 });
  }, []);
  return (
    <div ref={ref} className={className ? `${className} opacity-0` : "opacity-0"}>
      {children}
    </div>
  );
}
