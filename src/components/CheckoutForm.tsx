"use client";

import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { loadStripe, type Stripe } from "@stripe/stripe-js";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { captureClientException, track } from "@/lib/analytics";
import { brand } from "@/lib/brand";
import { formatUsd } from "@/lib/pricing";
import type { OrderView } from "@/lib/order/read";
import { postHogHeaders } from "@/lib/posthog-client";
import type { ShippingAddress, ShippingOption } from "@/types/order";

type Step = "address" | "shipping" | "payment";

const US_STATE_PATTERN = /^[A-Za-z]{2}$/;

export function CheckoutForm({
  order,
  orderToken,
  publishableKey,
}: {
  order: OrderView;
  /** This order's credential, from the checkout link. */
  orderToken: string;
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
  const [suggestedAddress, setSuggestedAddress] = useState<Partial<ShippingAddress> | null>(
    null,
  );
  const [addressAccepted, setAddressAccepted] = useState(false);
  const [level, setLevel] = useState<string | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [shippingPrice, setShippingPrice] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [archivalConsent, setArchivalConsent] = useState(false);

  const stripePromise = useMemo<Promise<Stripe | null> | null>(
    () => (publishableKey ? loadStripe(publishableKey) : null),
    [publishableKey],
  );

  const total = order.bookPrice + order.videoMemoryPrice + (shippingPrice ?? 0);

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
        headers: { "Content-Type": "application/json", ...postHogHeaders() },
        body: JSON.stringify({
          orderId: order.id,
          email: email.trim(),
          address: { ...address, state: address.state.toUpperCase() },
        }),
      });

      const data = (await response.json()) as {
        options?: ShippingOption[];
        addressWarning?: string;
        suggestedAddress?: Partial<ShippingAddress>;
        error?: string;
      };

      if (!response.ok) throw new Error(data.error ?? "Shipping lookup failed.");

      setOptions(data.options ?? []);
      setAddressWarning(data.addressWarning ?? null);
      setSuggestedAddress(data.suggestedAddress ?? null);
      setAddressAccepted(false);
      setLevel(data.options?.[0]?.level ?? null);
      setShippingPrice(data.options?.[0]?.price ?? null);
      setStep("shipping");
    } catch (quoteError) {
      captureClientException(quoteError);
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
    if (order.hasVideoMemories && !archivalConsent) {
      setError("Please confirm the Video Memories archival notice to continue.");
      return;
    }

    const needsConfirm = Boolean(addressWarning || suggestedAddress);
    if (needsConfirm && !addressAccepted) {
      setError(
        "Please confirm the shipping address suggestion (or edit your address) before paying.",
      );
      return;
    }

    setError(null);
    setBusy(true);

    try {
      const response = await fetch("/api/stripe/payment-intent", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-order-token": orderToken,
          ...postHogHeaders(),
        },
        body: JSON.stringify({
          orderId: order.id,
          email: email.trim(),
          shippingLevel: level,
          address: { ...address, state: address.state.toUpperCase() },
          acceptedAddressWarning: needsConfirm ? true : undefined,
          archivalConsent: order.hasVideoMemories ? archivalConsent : undefined,
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
      captureClientException(paymentError);
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
          <section className="rounded-2xl border border-line bg-white p-6 shadow-lift">
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
          <section className="rounded-2xl border border-line bg-white p-6 shadow-lift">
            <h1 className="font-display text-2xl text-ink">Delivery</h1>

            {addressWarning && (
              <p className="mt-3 rounded-lg border border-periwinkle/30 bg-periwinkle-wash/50 px-3 py-2 text-sm text-periwinkle-deep">
                {addressWarning}
              </p>
            )}

            {suggestedAddress && (
              <div className="mt-3 rounded-lg border border-line bg-cloud px-3 py-3 text-sm text-ink-soft">
                <p className="font-medium text-ink">Suggested address</p>
                <p className="mt-1 leading-6">
                  {[
                    suggestedAddress.street1,
                    suggestedAddress.street2,
                    [suggestedAddress.city, suggestedAddress.state]
                      .filter(Boolean)
                      .join(", "),
                    suggestedAddress.postcode,
                  ]
                    .filter(Boolean)
                    .join(", ")}
                </p>
                <div className="mt-3 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setAddress((current) => ({
                        ...current,
                        street1: suggestedAddress.street1 ?? current.street1,
                        street2:
                          suggestedAddress.street2 ?? current.street2 ?? "",
                        city: suggestedAddress.city ?? current.city,
                        state: (
                          suggestedAddress.state ?? current.state
                        ).toUpperCase(),
                        postcode:
                          suggestedAddress.postcode ?? current.postcode,
                      }));
                      setSuggestedAddress(null);
                      setAddressWarning(null);
                      setAddressAccepted(true);
                      setStep("address");
                    }}
                    className={linkButton}
                  >
                    Use suggested address
                  </button>
                </div>
              </div>
            )}

            {(addressWarning || suggestedAddress) && (
              <label className="mt-4 flex items-start gap-3 text-sm text-ink-soft">
                <input
                  type="checkbox"
                  checked={addressAccepted}
                  onChange={(event) => setAddressAccepted(event.target.checked)}
                  className="mt-1 accent-periwinkle"
                />
                <span>
                  I&rsquo;ve checked this address and want to continue with it as
                  entered (Lulu may still adjust formatting).
                </span>
              </label>
            )}

            <ul className="mt-5 space-y-3">
              {options.map((option) => (
                <li key={option.level}>
                  <label
                    className={`flex cursor-pointer items-center justify-between gap-4 rounded-xl border px-4 py-3 transition-colors ${
                      level === option.level
                        ? "border-periwinkle bg-periwinkle-wash/40"
                        : "border-line hover:border-periwinkle/60"
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
                        className="accent-[var(--color-periwinkle)]"
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

            {order.hasVideoMemories && (
              <VideoMemoryDisclosure
                packCount={order.videoMemoryPackCount}
                videoCount={order.selectedVideoCount}
                price={order.videoMemoryPrice}
                consented={archivalConsent}
                onConsent={setArchivalConsent}
              />
            )}

            <div className="mt-6 flex flex-wrap items-center gap-4">
              <button
                type="button"
                onClick={() => void startPayment()}
                disabled={
                  busy ||
                  !level ||
                  (Boolean(addressWarning || suggestedAddress) &&
                    !addressAccepted) ||
                  (order.hasVideoMemories && !archivalConsent)
                }
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
          <section className="rounded-2xl border border-line bg-white p-6 shadow-lift">
            <h1 className="font-display text-2xl text-ink">Payment</h1>
            <Elements
              stripe={stripePromise}
              options={{
                clientSecret,
                appearance: {
                  theme: "flat",
                  variables: {
                    colorPrimary: brand.colors.periwinkle,
                    colorBackground: brand.colors.white,
                    colorText: brand.colors.ink,
                    fontFamily: "Inter, system-ui, sans-serif",
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
          <section className="rounded-2xl border border-line bg-white p-6 shadow-lift">
            <h1 className="font-display text-2xl text-ink">
              Payments are not connected yet
            </h1>
            <p className="mt-3 text-sm leading-6 text-ink-soft">
              Add{" "}
              <code className="text-periwinkle-deep">
                NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
              </code>{" "}
              to <code className="text-periwinkle-deep">.env.local</code> to take
              payments.
            </p>
          </section>
        )}

        {error && (
          <p role="alert" className="text-sm text-periwinkle-deep">
            {error}
          </p>
        )}
      </div>

      <aside className="h-fit rounded-2xl border border-line bg-white p-6 shadow-lift">
        <h2 className="font-display text-lg text-ink">Your book</h2>
        <dl className="mt-4 space-y-2.5 text-sm">
          <Row label={`${order.petName ?? "Pet"} — hardcover 8.5 × 8.5 in`} />
          <Row
            label={`${order.chapterCount} chapters · ${order.storyPages} story pages`}
          />
          <Row label={`Plus 4 complimentary pages (${order.totalPages} total)`} />
          <div className="border-t border-line pt-3" />
          <Row label="Book" value={formatUsd(order.bookPrice)} />
          {order.hasVideoMemories && (
            <Row
              label={`Video Memories × ${order.videoMemoryPackCount}`}
              value={formatUsd(order.videoMemoryPrice)}
            />
          )}
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
      captureClientException(confirmError);
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
        <p role="alert" className="mt-3 text-sm text-periwinkle-deep">
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
  "w-full rounded-lg border border-line bg-white px-3.5 py-2.5 text-ink outline-none transition-colors placeholder:text-ink-faint focus:border-periwinkle focus:ring-2 focus:ring-periwinkle/20";

const primaryButton =
  "mt-6 rounded-xl bg-periwinkle px-7 py-3 text-base font-semibold text-white shadow-lift transition-colors hover:bg-periwinkle-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-periwinkle disabled:cursor-not-allowed disabled:opacity-50";

const linkButton =
  "text-sm text-ink-soft underline decoration-line underline-offset-4 transition-colors hover:text-periwinkle-deep";

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

function VideoMemoryDisclosure({
  packCount,
  videoCount,
  price,
  consented,
  onConsent,
}: {
  packCount: number;
  videoCount: number;
  price: number;
  consented: boolean;
  onConsent: (value: boolean) => void;
}) {
  return (
    <div className="mt-6 rounded-xl border border-periwinkle/30 bg-periwinkle-wash/40 p-4">
      <h2 className="font-display text-lg text-ink">Permanent Video Memories</h2>
      <p className="mt-2 text-sm leading-6 text-ink-soft">
        You&rsquo;re including {videoCount} Video{" "}
        {videoCount === 1 ? "Memory" : "Memories"} ({packCount}{" "}
        {packCount === 1 ? "pack" : "packs"}, {formatUsd(price)}). Before you
        pay, these videos stay private and you can still edit or remove them.
        After payment they are encrypted and preserved permanently so anyone with
        the printed QR code can watch them. They cannot be deleted from that
        storage later.
      </p>
      <label className="mt-4 flex items-start gap-3 text-sm text-ink">
        <input
          type="checkbox"
          checked={consented}
          onChange={(event) => onConsent(event.target.checked)}
          className="mt-1 accent-periwinkle"
        />
        <span>
          I understand these Video Memories will be preserved permanently after
          I pay, and that anyone with the printed QR code can watch them.
        </span>
      </label>
    </div>
  );
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
