"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Field, StepCard, inputClass, primaryButton } from "@/components/checkout/ui";
import { captureClientException } from "@/lib/analytics";
import { postHogHeaders } from "@/lib/posthog-client";
import type { ShippingAddress } from "@/types/order";

const US_STATE_PATTERN = /^[A-Za-z]{2}$/;

const EMPTY: ShippingAddress = {
  name: "",
  phone: "",
  street1: "",
  street2: "",
  city: "",
  state: "",
  postcode: "",
  country: "US",
};

/**
 * Where the book is going.
 *
 * Saved to the order before moving on rather than held in a component's state,
 * which is what lets the next step be a page of its own: the delivery options
 * are quoted against an address the server already has, and coming back here —
 * by the back button, by the step count above, or by a reload — finds the
 * address still filled in.
 */
export function AddressStep({
  orderId,
  orderToken,
  email: savedEmail,
  address: savedAddress,
  next,
}: {
  orderId: string;
  orderToken: string;
  email: string | null;
  address: ShippingAddress | null;
  /** Where the delivery step lives, with this order's credentials on it. */
  next: string;
}) {
  const router = useRouter();
  const [email, setEmail] = useState(savedEmail ?? "");
  const [address, setAddress] = useState<ShippingAddress>(savedAddress ?? EMPTY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const patch = (next: Partial<ShippingAddress>): void =>
    setAddress((current) => ({ ...current, ...next }));

  const save = async (): Promise<void> => {
    setError(null);

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError("Please enter the email address for your order confirmation.");
      return;
    }
    const missing = missingAddressField(address);
    if (missing) {
      setError(`Please add ${missing} before we look up delivery.`);
      return;
    }
    if (!US_STATE_PATTERN.test(address.state)) {
      setError("Please use a two-letter state code, such as CA.");
      return;
    }

    setBusy(true);
    try {
      const response = await fetch("/api/orders/shipping", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-order-token": orderToken,
          ...postHogHeaders(),
        },
        body: JSON.stringify({
          orderId,
          email: email.trim(),
          address: { ...address, state: address.state.toUpperCase() },
        }),
      });
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "That address could not be saved.");
      router.push(next);
    } catch (saveError) {
      captureClientException(saveError);
      setError(
        saveError instanceof Error
          ? saveError.message
          : "That address could not be saved.",
      );
      setBusy(false);
    }
  };

  return (
    <StepCard title="Where should it go?">
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
            onChange={(event) => patch({ name: event.target.value })}
            autoComplete="name"
            className={inputClass}
          />
        </Field>
        <Field label="Phone">
          <input
            value={address.phone}
            onChange={(event) => patch({ phone: event.target.value })}
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="415-555-0134"
            className={inputClass}
          />
        </Field>
        <Field label="Street address" span2>
          <input
            value={address.street1}
            onChange={(event) => patch({ street1: event.target.value })}
            autoComplete="address-line1"
            className={inputClass}
          />
        </Field>
        <Field label="Apartment, suite (optional)" span2>
          <input
            value={address.street2}
            onChange={(event) => patch({ street2: event.target.value })}
            autoComplete="address-line2"
            className={inputClass}
          />
        </Field>
        <Field label="City">
          <input
            value={address.city}
            onChange={(event) => patch({ city: event.target.value })}
            autoComplete="address-level2"
            className={inputClass}
          />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="State">
            <input
              value={address.state}
              onChange={(event) =>
                patch({ state: event.target.value.toUpperCase().slice(0, 2) })
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
              onChange={(event) => patch({ postcode: event.target.value })}
              autoComplete="postal-code"
              inputMode="numeric"
              className={inputClass}
            />
          </Field>
        </div>
      </div>

      {error ? (
        <p role="alert" className="mt-4 text-sm text-red-600">
          {error}
        </p>
      ) : null}

      <button
        type="button"
        onClick={() => void save()}
        disabled={busy}
        className={primaryButton}
      >
        {busy ? "Saving…" : "See delivery options"}
      </button>
    </StepCard>
  );
}

/** The first required field still empty, named the way the form labels it. */
function missingAddressField(address: ShippingAddress): string | null {
  if (!address.name.trim()) return "your name";
  if (!address.phone.trim()) return "a phone number";
  if (!address.street1.trim()) return "your street address";
  if (!address.city.trim()) return "your city";
  if (!address.state.trim()) return "your state";
  if (!address.postcode.trim()) return "your ZIP code";
  return null;
}
