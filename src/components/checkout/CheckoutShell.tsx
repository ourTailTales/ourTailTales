import Link from "next/link";
import type { ReactNode } from "react";

import { BrandMark } from "@/components/BrandMark";
import type { CheckoutStep } from "@/lib/order/checkout-access";

const STEPS: { id: CheckoutStep; label: string }[] = [
  { id: "address", label: "Address" },
  { id: "shipping", label: "Delivery" },
  { id: "payment", label: "Payment" },
];

/**
 * The frame every checkout step is shown in.
 *
 * The three steps used to be three states of one component behind one URL, so
 * the back button left the checkout entirely, a reload dropped somebody back
 * at the address form with everything they had typed gone, and there was no
 * way to link a customer to the step they were stuck on. Each step is its own
 * page now; this is what they have in common, including the count of where
 * the customer is in them.
 */
export function CheckoutShell({
  current,
  href,
  children,
  aside,
}: {
  current: CheckoutStep;
  /** Builds the link to another step of this same order. */
  href: (step: CheckoutStep) => string;
  children: ReactNode;
  aside?: ReactNode;
}) {
  const at = STEPS.findIndex((step) => step.id === current);

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-5 pb-24 pt-10 sm:pt-16">
      <header className="flex items-center justify-between gap-4">
        <BrandMark href="/" size="md" />
        <p className="text-xs font-medium tracking-wide text-ink-faint">Checkout</p>
      </header>

      <nav aria-label="Checkout steps" className="mt-8">
        <ol className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
          {STEPS.map((step, index) => {
            const done = index < at;
            const here = index === at;
            return (
              <li key={step.id} className="flex items-center gap-3">
                {index > 0 ? (
                  <span aria-hidden className="h-px w-6 bg-line sm:w-10" />
                ) : null}
                {done ? (
                  // Only a step already completed can be returned to: the ones
                  // ahead have nothing to show yet.
                  <Link
                    href={href(step.id)}
                    className="flex items-center gap-2 text-ink-soft underline decoration-line underline-offset-4 hover:text-periwinkle-deep"
                  >
                    <Count index={index} state="done" />
                    {step.label}
                  </Link>
                ) : (
                  <span
                    aria-current={here ? "step" : undefined}
                    className={`flex items-center gap-2 ${
                      here ? "font-semibold text-ink" : "text-ink-faint"
                    }`}
                  >
                    <Count index={index} state={here ? "here" : "ahead"} />
                    {step.label}
                  </span>
                )}
              </li>
            );
          })}
        </ol>
      </nav>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-6">{children}</div>
        {aside}
      </div>
    </main>
  );
}

function Count({
  index,
  state,
}: {
  index: number;
  state: "done" | "here" | "ahead";
}) {
  return (
    <span
      aria-hidden
      className={`flex size-6 items-center justify-center rounded-full text-xs font-semibold ${
        state === "here"
          ? "bg-periwinkle text-white"
          : state === "done"
            ? "bg-periwinkle-wash text-periwinkle-deep"
            : "bg-cloud text-ink-faint"
      }`}
    >
      {index + 1}
    </span>
  );
}
