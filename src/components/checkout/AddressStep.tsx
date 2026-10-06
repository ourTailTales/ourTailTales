"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Field, StepCard, inputClass, primaryButton } from "@/components/checkout/ui";
import { stateCode } from "@/components/checkout/us-states";
import { captureClientException } from "@/lib/analytics";
import { EXTRA_COPY_DISCOUNT, MAX_COPIES, copiesTotal, extraCopyPrice, formatUsd } from "@/lib/pricing";
import { postHogHeaders } from "@/lib/posthog-client";
import type { ShippingAddress } from "@/types/order";
import { customerMessage } from "@/lib/customer-message";

const US_ZIP_PATTERN = /^\d{5}(-\d{4})?$/;

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
  unitPrice,
  quantity: savedQuantity,
  next,
}: {
  orderId: string;
  orderToken: string;
  email: string | null;
  address: ShippingAddress | null;
  /** The price of one copy, so further copies can be priced beside the choice. */
  unitPrice: number;
  quantity: number;
  /** Where the delivery step lives, with this order's credentials on it. */
  next: string;
}) {
  const router = useRouter();
  const [email, setEmail] = useState(savedEmail ?? "");
  const [address, setAddress] = useState<ShippingAddress>(savedAddress ?? EMPTY);
  const [quantity, setQuantity] = useState(savedQuantity);
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
    // A code or a full name, whichever was typed or autofilled. Saved as the
    // code either way.
    const state = stateCode(address.state);
    if (!state) {
      setError("Please enter a US state, such as CA or California.");
      return;
    }
    if (!US_ZIP_PATTERN.test(address.postcode.trim())) {
      setError("Please enter a ZIP code like 78701.");
      return;
    }
    // Shown as the code from here on, so what is on screen is what was saved.
    patch({ state });

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
          quantity,
          address: {
            ...address,
            state,
            postcode: address.postcode.trim(),
          },
        }),
      });
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "That address could not be saved.");
      router.push(next);
    } catch (saveError) {
      captureClientException(saveError);
      setError(
        customerMessage(
          saveError,
          "That address could not be saved. Check your connection and try again.",
        ),
      );
      setBusy(false);
    }
  };

  return (
    <StepCard title="Where should it go?">
      {/* A real form, so Enter moves on and the browser's autofill has
          something to attach to. Our own checks run in `save`. */}
      <form
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          if (!busy) void save();
        }}
      >
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
              // Kept as typed. Autofill often supplies the full name, and
              // cutting it to two letters made "Arizona" into "AR".
              onChange={(event) => patch({ state: event.target.value })}
              autoComplete="address-level1"
              placeholder="CA"
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

      <fieldset className="mt-6 rounded-xl border border-line bg-cloud px-4 py-4">
        <legend className="px-1 text-sm font-medium text-ink-soft">
          How many copies?
        </legend>
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              aria-label="One copy fewer"
              disabled={quantity <= 1}
              onClick={() => setQuantity((current) => Math.max(1, current - 1))}
              className="h-11 w-11 rounded-lg border border-line bg-white text-lg text-ink disabled:opacity-40"
            >
              −
            </button>
            <output aria-live="polite" className="w-6 text-center text-lg font-medium text-ink">
              {quantity}
            </output>
            <button
              type="button"
              aria-label="One copy more"
              disabled={quantity >= MAX_COPIES}
              onClick={() => setQuantity((current) => Math.min(MAX_COPIES, current + 1))}
              className="h-11 w-11 rounded-lg border border-line bg-white text-lg text-ink disabled:opacity-40"
            >
              +
            </button>
          </div>
          <p className="text-sm leading-6 text-ink-soft">
            {quantity === 1
              ? `Add a copy for family for ${formatUsd(extraCopyPrice(unitPrice))}. That is ${Math.round(EXTRA_COPY_DISCOUNT * 100)}% off.`
              : `${quantity} copies for ${formatUsd(copiesTotal(unitPrice, quantity))}. Each extra copy is ${Math.round(EXTRA_COPY_DISCOUNT * 100)}% off.`}
          </p>
        </div>
      </fieldset>

      {error ? (
        <p role="alert" className="mt-4 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      <button type="submit" disabled={busy} className={primaryButton}>
        {busy ? "Saving…" : "See delivery options"}
      </button>
      </form>
    </StepCard>
  );
}

/** The first required field still empty, named the way the form labels it. */
function missingAddressField(address: ShippingAddress): string | null {
  if (!address.name.trim()) return "your name";
  if (address.phone.replace(/\D/g, "").length < 7) return "a phone number with its area code";
  if (!address.street1.trim()) return "your street address";
  if (!address.city.trim()) return "your city";
  if (!address.state.trim()) return "your state";
  if (!address.postcode.trim()) return "your ZIP code";
  return null;
}
