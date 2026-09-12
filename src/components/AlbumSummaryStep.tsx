"use client";

import type { BookMeta } from "@/types/book";

type Summary = {
  total: number;
  placeable: number;
  duplicates: number;
  weak: number;
  approximateDates: boolean;
  withGps: number;
  firstAt: number | null;
  lastAt: number | null;
};

export function AlbumSummaryStep({
  summary,
  meta,
  onMetaChange,
  onContinue,
  onStartOver,
}: {
  summary: Summary;
  meta: BookMeta;
  onMetaChange: (patch: Partial<BookMeta>) => void;
  onContinue: () => void;
  onStartOver: () => void;
}) {
  const canContinue = meta.petName.trim().length > 0 && summary.placeable > 0;

  return (
    <section className="animate-fade-up space-y-8">
      <div className="rounded-2xl border border-line bg-paper-deep/40 p-6 sm:p-8">
        <h2 className="font-display text-2xl text-ink">Here&rsquo;s what we found</h2>

        <dl className="mt-5 grid grid-cols-2 gap-5 sm:grid-cols-4">
          <Stat label="Photos read" value={summary.total.toLocaleString()} />
          <Stat label="Ready to place" value={summary.placeable.toLocaleString()} />
          <Stat label="Years covered" value={formatRange(summary.firstAt, summary.lastAt)} />
          <Stat
            label="With location"
            value={
              summary.withGps > 0 ? summary.withGps.toLocaleString() : "None found"
            }
          />
        </dl>

        <ul className="mt-5 space-y-1.5 text-sm text-ink-soft">
          {summary.duplicates > 0 && (
            <li>
              {summary.duplicates.toLocaleString()} near-duplicate
              {summary.duplicates === 1 ? "" : "s"} were set aside. We kept the
              best version of each and nothing was deleted.
            </li>
          )}
          {summary.weak > 0 && (
            <li>
              {summary.weak.toLocaleString()} photo
              {summary.weak === 1 ? " is" : "s are"} too small or too dark to
              print well, so they won&rsquo;t be chosen automatically.
            </li>
          )}
          {summary.approximateDates && (
            <li>
              Some photos had no capture date, so those dates are approximate.
            </li>
          )}
          {summary.withGps === 0 && (
            <li>
              No location data was found, so chapters will be built from dates
              alone.
            </li>
          )}
        </ul>
      </div>

      <div className="rounded-2xl border border-line bg-paper p-6 shadow-lift sm:p-8">
        <h2 className="font-display text-2xl text-ink">
          Tell us about them
        </h2>
        <p className="mt-2 text-sm text-ink-soft">
          Only what the album can&rsquo;t tell us on its own.
        </p>

        <div className="mt-6 grid gap-5 sm:grid-cols-2">
          <Field label="Pet's name" htmlFor="petName" required>
            <input
              id="petName"
              value={meta.petName}
              onChange={(event) => onMetaChange({ petName: event.target.value })}
              placeholder="Biscuit"
              autoComplete="off"
              className={inputClass}
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Birth year" htmlFor="birthYear">
              <input
                id="birthYear"
                value={meta.birthYear}
                onChange={(event) =>
                  onMetaChange({ birthYear: digitsOnly(event.target.value) })
                }
                placeholder="2012"
                inputMode="numeric"
                maxLength={4}
                className={inputClass}
              />
            </Field>
            <Field label="Final year" htmlFor="deathYear">
              <input
                id="deathYear"
                value={meta.deathYear}
                onChange={(event) =>
                  onMetaChange({ deathYear: digitsOnly(event.target.value) })
                }
                placeholder="2024"
                inputMode="numeric"
                maxLength={4}
                className={inputClass}
              />
            </Field>
          </div>

          <div className="sm:col-span-2">
            <Field label="Dedication (optional)" htmlFor="dedication">
              <textarea
                id="dedication"
                value={meta.dedication}
                onChange={(event) =>
                  onMetaChange({ dedication: event.target.value.slice(0, 320) })
                }
                rows={3}
                placeholder="For the best copilot a family could ask for."
                className={`${inputClass} resize-none`}
              />
            </Field>
            <p className="mt-1.5 text-xs text-ink-faint">
              Printed on its own page near the front of the book.
            </p>
          </div>
        </div>

        <div className="mt-7 flex flex-wrap items-center gap-4">
          <button
            type="button"
            onClick={onContinue}
            disabled={!canContinue}
            className="rounded-full bg-tail px-7 py-3 text-base font-medium text-paper shadow-lift transition-colors hover:bg-tail-deep disabled:cursor-not-allowed disabled:opacity-50"
          >
            Continue
          </button>
          <button
            type="button"
            onClick={onStartOver}
            className="text-sm text-ink-soft underline decoration-line underline-offset-4 transition-colors hover:text-tail-deep"
          >
            Choose a different album
          </button>
          {!canContinue && summary.placeable > 0 && (
            <p className="text-sm text-ink-faint">
              Add their name to continue.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

const inputClass =
  "w-full rounded-lg border border-line bg-paper px-3.5 py-2.5 text-ink outline-none transition-colors placeholder:text-ink-faint focus:border-tail focus:ring-2 focus:ring-tail/20";

function Field({
  label,
  htmlFor,
  required,
  children,
}: {
  label: string;
  htmlFor: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label
        htmlFor={htmlFor}
        className="mb-1.5 block text-sm font-medium text-ink-soft"
      >
        {label}
        {required && <span className="text-tail"> *</span>}
      </label>
      {children}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-ink-faint">{label}</dt>
      <dd className="mt-1 font-display text-xl text-ink">{value}</dd>
    </div>
  );
}

function formatRange(firstAt: number | null, lastAt: number | null): string {
  if (firstAt === null) return "Unknown";
  const start = new Date(firstAt).getFullYear();
  const end = lastAt !== null ? new Date(lastAt).getFullYear() : start;
  return start === end ? `${start}` : `${start}–${end}`;
}

function digitsOnly(value: string): string {
  return value.replace(/\D/g, "").slice(0, 4);
}
