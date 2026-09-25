"use client";

import { Cat, Dog } from "lucide-react";
import { useId, useState } from "react";

import { useOurTailTalesStore } from "@/store/useOurTailTalesStore";

/**
 * Two cards, a name, and a button.
 *
 * The old intake was a form: name, species, whether the animal was still
 * alive, the years, a free-text note. Five questions on the first screen
 * anyone sees after handing over their address, and four of them optional,
 * which is a long way of saying four of them were noise. This asks the two
 * things the writer genuinely cannot get from the photographs and nothing
 * else, and it asks them by tapping a picture rather than filling a field.
 *
 * The dedication is the one optional thing asked here: it is the customer's
 * own words, so the writer cannot supply it, and it has to exist before the
 * free pages are made or those pages would open on an empty one.
 *
 * The name is typed straight onto the chosen card, flat against it, so the
 * card reads as the beginning of the cover rather than as an input with a
 * picture next to it. Everything else the book needs stays editable from the
 * title page once the book exists.
 */

type Species = "dog" | "cat";

export function PetIntake({
  onDone,
  confirmed = false,
}: {
  onDone: () => void;
  /**
   * The animal has already been confirmed and the upload section is showing
   * beneath this one. The cards and name stay editable — someone can still
   * fix a typo or swap dog for cat — but the Confirm button's job is done, so
   * it goes: a second, redundant button sitting above the photos would read
   * as something still left to do.
   */
  confirmed?: boolean;
}) {
  const meta = useOurTailTalesStore((state) => state.meta);
  const setMeta = useOurTailTalesStore((state) => state.setMeta);

  const [attempted, setAttempted] = useState(false);

  const name = meta.petName.trim();
  const chosen = (meta.species?.toLowerCase() ?? "") as Species | "";
  const ready = Boolean(chosen) && Boolean(name);

  const submit = (): void => {
    setAttempted(true);
    if (!ready) return;
    onDone();
  };

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col justify-center py-10">
      <h1 className="text-center font-display text-3xl leading-tight text-page-ink sm:text-4xl">
        Who is the book about?
      </h1>
      <p className="mt-3 text-center text-sm leading-6 text-page-ink-soft">
        Pick one, then type their name.
      </p>

      <form
        className="mt-9"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <div className="grid grid-cols-2 gap-4 sm:gap-6">
          {(["dog", "cat"] as const).map((species) => (
            <PetCard
              key={species}
              species={species}
              selected={chosen === species}
              dimmed={Boolean(chosen) && chosen !== species}
              name={meta.petName}
              onSelect={() => setMeta({ species })}
              onName={(value) => setMeta({ petName: value.slice(0, 60) })}
              onSubmit={submit}
              invalid={attempted && chosen === species && !name}
            />
          ))}
        </div>

        {attempted && !chosen ? (
          <p role="alert" className="mt-4 text-center text-xs text-red-600">
            Pick a dog or a cat to start.
          </p>
        ) : null}

        {chosen ? (
          <label className="mt-8 block">
            <span className="flex items-baseline justify-between text-sm font-medium text-page-ink">
              Dedication{" "}
              <span className="text-xs font-normal text-page-ink-faint">
                optional · {meta.dedication.length}/320
              </span>
            </span>
            <textarea
              value={meta.dedication}
              onChange={(event) =>
                setMeta({ dedication: event.target.value.slice(0, 320) })
              }
              rows={3}
              placeholder={`For ${name || "the best friend"} — who made every day better.`}
              className="mt-2 w-full resize-none rounded-xl border border-page-line bg-white px-4 py-3 text-base leading-relaxed text-page-ink outline-none transition-colors placeholder:text-page-ink-faint focus:border-periwinkle"
            />
            <span className="mt-1.5 block text-xs text-page-ink-faint">
              A line or two on its own page at the front. Leave it empty and
              the book goes straight to the story.
            </span>
          </label>
        ) : null}

        {attempted && chosen && !name ? (
          <p role="alert" className="mt-4 text-center text-xs text-red-600">
            Enter their name to continue.
          </p>
        ) : null}

        {confirmed ? null : (
          <button
            type="submit"
            disabled={!ready}
            className="mt-8 inline-flex min-h-13 w-full items-center justify-center rounded-xl bg-periwinkle px-6 text-base font-semibold text-white shadow-lift transition-all duration-300 hover:bg-periwinkle-deep disabled:cursor-not-allowed disabled:bg-page-line disabled:text-page-ink-faint disabled:shadow-none"
          >
            Confirm
          </button>
        )}
      </form>
    </div>
  );
}

/**
 * One animal, with the name written on it once it is the chosen one.
 *
 * The input is a sibling of the card button rather than a child of it, which
 * is what lets someone type on the card without the click landing on the
 * card's own control, and it carries no border, no fill and no shadow: the
 * card is the surface, and the name sits on it.
 */
function PetCard({
  species,
  selected,
  dimmed,
  name,
  onSelect,
  onName,
  onSubmit,
  invalid,
}: {
  species: Species;
  selected: boolean;
  dimmed: boolean;
  name: string;
  onSelect: () => void;
  onName: (value: string) => void;
  onSubmit: () => void;
  invalid: boolean;
}) {
  const label = species === "dog" ? "Dog" : "Cat";
  const errorId = useId();

  // The name is required, and a field that only says so after Confirm is
  // pressed is easy to miss: once someone has been in it and left it empty,
  // it says so there and then.
  const [touched, setTouched] = useState(false);
  const showError = invalid || (touched && !name.trim());

  // Written on the card, so it has to fit the card. A long name steps down
  // rather than scrolling half of itself out of sight.
  const nameSize =
    name.trim().length > 13
      ? "text-base sm:text-xl"
      : name.trim().length > 8
        ? "text-lg sm:text-2xl"
        : "text-2xl sm:text-3xl";

  return (
    <div className="relative">
      <button
        type="button"
        onClick={onSelect}
        aria-pressed={selected}
        aria-label={label}
        className={`flex aspect-4/5 w-full flex-col items-center justify-center gap-4 rounded-3xl border bg-white transition-all duration-300 ease-out ${
          selected
            ? "border-periwinkle ring-2 ring-periwinkle/25"
            : "border-page-line hover:border-periwinkle hover:-translate-y-0.5"
        } ${dimmed ? "opacity-45 saturate-50" : "opacity-100"}`}
      >
        <PetGlyph
          species={species}
          className={`h-1/2 w-1/2 max-h-32 max-w-32 transition-colors duration-300 ${
            selected ? "text-periwinkle" : "text-page-ink/30"
          }`}
        />
        <span
          className={`font-display text-lg transition-opacity duration-200 ${
            selected ? "opacity-0" : "text-page-ink-soft opacity-100"
          }`}
          aria-hidden={selected}
        >
          {label}
        </span>
      </button>

      {selected ? (
        <div className="group pointer-events-none absolute inset-x-2.5 bottom-5 sm:inset-x-5 sm:bottom-6">
          <input
            type="text"
            autoFocus
            required
            aria-required
            value={name}
            onChange={(event) => onName(event.target.value)}
            onBlur={() => setTouched(true)}
            onKeyDown={(event) => {
              if (event.key !== "Enter") return;
              event.preventDefault();
              onSubmit();
            }}
            placeholder="Their name"
            aria-label={`Your ${species}'s name (required)`}
            aria-invalid={showError}
            aria-describedby={showError ? errorId : undefined}
            className={`pointer-events-auto w-full border-0 bg-transparent p-0 text-center font-display text-page-ink shadow-none outline-none placeholder:font-sans placeholder:text-xl placeholder:font-normal placeholder:text-page-ink-faint focus:outline-none sm:placeholder:text-2xl ${nameSize}`}
          />
          <div className="relative mx-auto mt-2 w-24">
            <span
              aria-hidden
              className={`block h-0.5 w-full rounded-full transition-colors duration-300 ${
                showError
                  ? "bg-red-500"
                  : "bg-page-ink/30 group-focus-within:bg-periwinkle"
              }`}
            />
            {showError ? (
              // Required, and still empty after they moved on.
              <span
                aria-hidden
                className="absolute -right-4 -top-8 text-2xl font-semibold leading-none text-red-600"
              >
                *
              </span>
            ) : null}
          </div>
          {showError ? (
            <p id={errorId} className="mt-1.5 text-center text-xs text-red-600">
              Their name is required
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/**
 * Dog or cat, from lucide's icon set rather than drawn by hand — the same
 * library every other icon in this app already comes from, so this pairs
 * with the rest of the UI instead of introducing its own style.
 */
function PetGlyph({
  species,
  className,
}: {
  species: Species;
  className?: string;
}) {
  const Icon = species === "cat" ? Cat : Dog;
  return <Icon aria-hidden className={className} strokeWidth={1.25} />;
}
