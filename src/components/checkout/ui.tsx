import type { ReactNode } from "react";

/** The look every checkout step shares, so three pages stay one form. */
export const inputClass =
  "w-full rounded-lg border border-line bg-white px-3.5 py-2.5 text-ink outline-none transition-colors placeholder:text-ink-faint focus:border-periwinkle focus:ring-2 focus:ring-periwinkle/20";

export const primaryButton =
  "mt-6 rounded-xl bg-periwinkle px-7 py-3 text-base font-semibold text-white shadow-lift transition-colors hover:bg-periwinkle-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-periwinkle disabled:cursor-not-allowed disabled:opacity-50";

export const linkButton =
  "text-sm text-ink-soft underline decoration-line underline-offset-4 transition-colors hover:text-periwinkle-deep";

export function Field({
  label,
  span2,
  children,
}: {
  label: string;
  span2?: boolean;
  children: ReactNode;
}) {
  return (
    <label className={`block ${span2 ? "sm:col-span-2" : ""}`}>
      <span className="mb-1.5 block text-sm font-medium text-ink-soft">{label}</span>
      {children}
    </label>
  );
}

export function StepCard({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-line bg-white p-6 shadow-lift">
      <h1 className="font-display text-2xl text-ink">{title}</h1>
      {children}
    </section>
  );
}

export function CheckoutNotice({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="mt-12 rounded-2xl border border-line bg-white p-8 shadow-lift">
      <h1 className="font-display text-2xl text-ink">{title}</h1>
      <p className="mt-3 text-sm leading-6 text-ink-soft">{children}</p>
    </section>
  );
}
