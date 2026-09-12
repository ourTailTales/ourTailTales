"use client";

import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { loadStripe, type Stripe } from "@stripe/stripe-js";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { track } from "@/lib/analytics";
import { formatUsd } from "@/lib/pricing";
import type { OrderView } from "@/lib/order/read";
import type { ShippingAddress, ShippingOption } from "@/types/order";

type Step = "address" | "shipping" | "payment";

const US_STATE_PATTERN = /^[A-Za-z]{2}$/;

export function CheckoutForm({
  order,
  publishableKey,
}: {
  order: OrderView;
  publishableKey: string | null;
}) {
  const [step, setStep] = useState<Step>("address");
  const [email, setEmail] = useState(order.email ?? "");
  const [address, setAddress] = useState<ShippingAddress>({
    name: "",
    phone: "",
    street1: "",
    street2: "",
    city: "",
    state: "",
    postcode: "",
    country: "US",
  });

  const [options, setOptions] = useState<ShippingOption[]>([]);
  const [addressWarning, setAddressWarning] = useState<string | null>(null);
  const [level, setLevel] = useState<string | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [shippingPrice, setShippingPrice] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const stripePromise = useMemo<Promise<Stripe | null> | null>(
    () => (publishableKey ? loadStripe(publishableKey) : null),
    [publishableKey],
  );

  const total = order.bookPrice + (shippingPrice ?? 0);

  const fetchQuote = async (): Promise<void> => {
    setError(null);

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError("Please enter the email address for your order confirmation.");
      return;
    }
    if (!US_STATE_PATTERN.test(address.state)) {
      setError("Please use a two-letter state code, such as CA.");
      return;
    }

    setBusy(true);
    try {
      const response = await fetch("/api/lulu/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: order.id,
          address: { ...address, state: address.state.toUpperCase() },
        }),
      });

      const data = (await response.json()) as {
        options?: ShippingOption[];
        addressWarning?: string;
        error?: string;
      };

      if (!response.ok) throw new Error(data.error ?? "Shipping lookup failed.");

      setOptions(data.options ?? []);
      setAddressWarning(data.addressWarning ?? null);
      setLevel(data.options?.[0]?.level ?? null);
      setShippingPrice(data.options?.[0]?.price ?? null);
      setStep("shipping");
    } catch (quoteError) {
      setError(
        quoteError instanceof Error
          ? quoteError.message
          : "Shipping could not be calculated.",
      );
    } finally {
      setBusy(false);
    }
  };

  const startPayment = async (): Promise<void> => {
    if (!level) return;
    setError(null);
    setBusy(true);

    try {
      const response = await fetch("/api/stripe/payment-intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: order.id,
          email: email.trim(),
          shippingLevel: level,
          address: { ...address, state: address.state.toUpperCase() },
        }),
      });

      const data = (await response.json()) as {
        clientSecret?: string;
        shippingPrice?: number;
        error?: string;
      };

      if (!response.ok || !data.clientSecret) {
        throw new Error(data.error ?? "Payment could not be set up.");
      }

      setShippingPrice(data.shippingPrice ?? shippingPrice);
      setClientSecret(data.clientSecret);
      setStep("payment");
    } catch (paymentError) {
      setError(
        paymentError instanceof Error
          ? paymentError.message
          : "Payment could not be set up.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-10 grid gap-8 lg:grid-cols-[1.4fr_1fr]">
      <div className="space-y-6">
        {step === "address" && (
          <section className="rounded-2xl border border-line bg-paper p-6 shadow-lift">
            <h1 className="font-display text-2xl text-ink">Where should it go?</h1>
            <p className="mt-2 text-sm text-ink-soft">
              We print and ship within the United States.
            </p>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <Field label="Email" span2>
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  autoComplete="email"
                  className={inputClass}
                />
              </Field>
              <Field label="Full name">
                <input
                  value={address.name}
                  onChange={(event) => patch(setAddress, { name: event.target.value })}
                  autoComplete="name"
                  className={inputClass}
                />
              </Field>
              <Field label="Phone">
                <input
                  value={address.phone}
                  onChange={(event) => patch(setAddress, { phone: event.target.value })}
                  autoComplete="tel"
                  placeholder="415-555-0134"
                  className={inputClass}
                />
              </Field>
              <Field label="Street address" span2>
                <input
                  value={address.street1}
                  onChange={(event) =>
                    patch(setAddress, { street1: event.target.value })
                  }
                  autoComplete="address-line1"
                  className={inputClass}
                />
              </Field>
              <Field label="Apartment, suite (optional)" span2>
                <input
                  value={address.street2}
                  onChange={(event) =>
                    patch(setAddress, { street2: event.target.value })
                  }
                  autoComplete="address-line2"
                  className={inputClass}
                />
              </Field>
              <Field label="City">
                <input
                  value={address.city}
                  onChange={(event) => patch(setAddress, { city: event.target.value })}
                  autoComplete="address-level2"
                  className={inputClass}
                />
              </Field>
              <div className="grid grid-cols-2 gap-4">
                <Field label="State">
                  <input
                    value={address.state}
                    onChange={(event) =>
                      patch(setAddress, {
                        state: event.target.value.toUpperCase().slice(0, 2),
                      })
                    }
                    autoComplete="address-level1"
                    placeholder="CA"
                    maxLength={2}
                    className={inputClass}
                  />
                </Field>
                <Field label="ZIP">
                  <input
                    value={address.postcode}
                    onChange={(event) =>
                      patch(setAddress, { postcode: event.target.value })
                    }
                    autoComplete="postal-code"
                    inputMode="numeric"
                    className={inputClass}
                  />
                </Field>
              </div>
            </div>

            <button
              type="button"
              onClick={() => void fetchQuote()}
              disabled={busy || !isAddressComplete(address)}
              className={primaryButton}
            >
              {busy ? "Checking delivery…" : "See delivery options"}
            </button>
          </section>
        )}

        {step === "shipping" && (
          <section className="rounded-2xl border border-line bg-paper p-6 shadow-lift">
            <h1 className="font-display text-2xl text-ink">Delivery</h1>

            {addressWarning && (
              <p className="mt-3 rounded-lg border border-tail/30 bg-tail-wash/50 px-3 py-2 text-sm text-tail-deep">
                {addressWarning} Please confirm this is right before paying.
              </p>
            )}

            <ul className="mt-5 space-y-3">
              {options.map((option) => (
                <li key={option.level}>
                  <label
                    className={`flex cursor-pointer items-center justify-between gap-4 rounded-xl border px-4 py-3 transition-colors ${
                      level === option.level
                        ? "border-tail bg-tail-wash/40"
                        : "border-line hover:border-tail/60"
                    }`}
                  >
                    <span className="flex items-center gap-3">
                      <input
                        type="radio"
                        name="shippingLevel"
                        checked={level === option.level}
                        onChange={() => {
                          setLevel(option.level);
                          setShippingPrice(option.price);
                        }}
                        className="accent-[var(--color-tail)]"
                      />
                      <span>
                        <span className="block text-sm font-medium text-ink">
                          {option.label}
                        </span>
                        {option.minDeliveryDays && option.maxDeliveryDays && (
                          <span className="block text-xs text-ink-faint">
                            About {option.minDeliveryDays}–{option.maxDeliveryDays}{" "}
                            business days, including printing
                          </span>
                        )}
                      </span>
                    </span>
                    <span className="font-display text-lg text-ink">
                      {formatUsd(option.price)}
                    </span>
                  </label>
                </li>
              ))}
            </ul>

            <div className="mt-6 flex flex-wrap items-center gap-4">
              <button
                type="button"
                onClick={() => void startPayment()}
                disabled={busy || !level}
                className={primaryButton}
              >
                {busy ? "Preparing payment…" : "Continue to payment"}
              </button>
              <button
                type="button"
                onClick={() => setStep("address")}
                className={linkButton}
              >
                Edit address
              </button>
            </div>
          </section>
        )}

        {step === "payment" && clientSecret && stripePromise && (
          <section className="rounded-2xl border border-line bg-paper p-6 shadow-lift">
            <h1 className="font-display text-2xl text-ink">Payment</h1>
            <Elements
              stripe={stripePromise}
              options={{
                clientSecret,
                appearance: {
                  theme: "flat",
                  variables: {
                    colorPrimary: "#b1573a",
                    colorBackground: "#fbf7f0",
                    colorText: "#241f1a",
                    fontFamily: "system-ui, sans-serif",
                    borderRadius: "8px",
                  },
                },
              }}
            >
              <PaymentStep orderId={order.id} total={total} />
            </Elements>
            <button
              type="button"
              onClick={() => setStep("shipping")}
              className={`${linkButton} mt-4`}
            >
              Change delivery
            </button>
          </section>
        )}

        {step === "payment" && !stripePromise && (
          <section className="rounded-2xl border border-line bg-paper-deep/40 p-6">
            <h1 className="font-display text-2xl text-ink">
              Payments are not connected yet
            </h1>
            <p className="mt-3 text-sm leading-6 text-ink-soft">
              Add{" "}
              <code className="text-tail-deep">
                NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
              </code>{" "}
              to <code className="text-tail-deep">.env.local</code> to take
              payments.
            </p>
          </section>
        )}

        {error && (
          <p role="alert" className="text-sm text-tail-deep">
            {error}
          </p>
        )}
      </div>

      <aside className="h-fit rounded-2xl border border-line bg-paper-deep/40 p-6">
        <h2 className="font-display text-lg text-ink">Your book</h2>
        <dl className="mt-4 space-y-2.5 text-sm">
          <Row label={`${order.petName ?? "Pet"} — hardcover 8.5 × 8.5 in`} />
          <Row
            label={`${order.chapterCount} chapters · ${order.storyPages} story pages`}
          />
          <Row label={`Plus 4 complimentary pages (${order.totalPages} total)`} />
          <div className="border-t border-line pt-3" />
          <Row label="Book" value={formatUsd(order.bookPrice)} />
          <Row
            label="Shipping"
            value={
              shippingPrice === null ? "Calculated next" : formatUsd(shippingPrice)
            }
          />
          <div className="border-t border-line pt-3" />
          <Row label="Total" value={formatUsd(total)} strong />
        </dl>
        <p className="mt-4 text-xs leading-5 text-ink-faint">
          Printed and bound to order. Your photos were never uploaded to build
          this book — only the finished print files were.
        </p>
      </aside>
    </div>
  );
}

function PaymentStep({ orderId, total }: { orderId: string; total: number }) {
  const stripe = useStripe();
  const elements = useElements();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pay = async (): Promise<void> => {
    if (!stripe || !elements) return;
    setBusy(true);
    setError(null);

    const { error: confirmError } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/order/${orderId}`,
      },
      redirect: "if_required",
    });

    if (confirmError) {
      setBusy(false);
      setError(confirmError.message ?? "That payment could not be completed.");
      return;
    }

    track("payment_succeeded", { total });
    router.push(`/order/${orderId}`);
  };

  return (
    <div className="mt-5">
      <PaymentElement />
      <button
        type="button"
        onClick={() => void pay()}
        disabled={busy || !stripe}
        className={primaryButton}
      >
        {busy ? "Processing…" : `Pay ${formatUsd(total)}`}
      </button>
      {error && (
        <p role="alert" className="mt-3 text-sm text-tail-deep">
          {error}
        </p>
      )}
      <p className="mt-3 text-xs text-ink-faint">
        We only start printing once your payment is confirmed.
      </p>
    </div>
  );
}

const inputClass =
  "w-full rounded-lg border border-line bg-paper px-3.5 py-2.5 text-ink outline-none transition-colors placeholder:text-ink-faint focus:border-tail focus:ring-2 focus:ring-tail/20";

const primaryButton =
  "mt-6 rounded-full bg-tail px-7 py-3 text-base font-medium text-paper shadow-lift transition-colors hover:bg-tail-deep disabled:cursor-not-allowed disabled:opacity-50";

const linkButton =
  "text-sm text-ink-soft underline decoration-line underline-offset-4 transition-colors hover:text-tail-deep";

function Field({
  label,
  span2,
  children,
}: {
  label: string;
  span2?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className={`block ${span2 ? "sm:col-span-2" : ""}`}>
      <span className="mb-1.5 block text-sm font-medium text-ink-soft">
        {label}
      </span>
      {children}
    </label>
  );
}

function Row({
  label,
  value,
  strong,
}: {
  label: string;
  value?: string;
  strong?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className={strong ? "font-medium text-ink" : "text-ink-soft"}>{label}</dt>
      {value && (
        <dd
          className={
            strong ? "font-display text-lg text-ink" : "text-ink whitespace-nowrap"
          }
        >
          {value}
        </dd>
      )}
    </div>
  );
}

function patch(
  setAddress: React.Dispatch<React.SetStateAction<ShippingAddress>>,
  next: Partial<ShippingAddress>,
): void {
  setAddress((current) => ({ ...current, ...next }));
}

function isAddressComplete(address: ShippingAddress): boolean {
  return Boolean(
    address.name &&
      address.phone &&
      address.street1 &&
      address.city &&
      address.state &&
      address.postcode,
  );
}
