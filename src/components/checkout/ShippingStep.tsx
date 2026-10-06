"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { StepCard, linkButton, primaryButton } from "@/components/checkout/ui";
import { captureClientException } from "@/lib/analytics";
import { formatUsd } from "@/lib/pricing";
import { postHogHeaders } from "@/lib/posthog-client";
import type { ShippingAddress, ShippingOption } from "@/types/order";
import { customerMessage } from "@/lib/customer-message";

/**
 * How fast, and what Lulu thinks of the address.
 *
 * The quote is asked for here rather than carried from the previous page: the
 * address is on the order, so this page can be opened cold — from the step
 * count, the back button, a reload — and still show real options and the real
 * warnings against the address that was actually saved.
 */
export function ShippingStep({
  orderId,
  orderToken,
  address,
  savedLevel,
  email,
  hasVideoMemories,
  videoMemoryPackCount,
  videoMemoryCount,
  videoMemoryPrice,
  addressHref,
  next,
  notice,
}: {
  orderId: string;
  orderToken: string;
  address: ShippingAddress;
  savedLevel: string | null;
  email: string | null;
  hasVideoMemories: boolean;
  videoMemoryPackCount: number;
  videoMemoryCount: number;
  videoMemoryPrice: number;
  addressHref: string;
  next: string;
  /** Why the customer was sent back here, when they were. */
  notice?: string | null;
}) {
  const router = useRouter();
  const [options, setOptions] = useState<ShippingOption[] | null>(null);
  const [level, setLevel] = useState<string | null>(savedLevel);
  const [addressWarning, setAddressWarning] = useState<string | null>(null);
  const [suggestedAddress, setSuggestedAddress] =
    useState<Partial<ShippingAddress> | null>(null);
  const [addressAccepted, setAddressAccepted] = useState(false);
  const [archivalConsent, setArchivalConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Bumped to ask for the delivery prices again after a failed attempt. */
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const quoted = await quote(orderId, orderToken, email, address);
        if (cancelled) return;
        setOptions(quoted.options);
        setAddressWarning(quoted.addressWarning);
        setSuggestedAddress(quoted.suggestedAddress);
        setLevel((current) => {
          const kept = quoted.options.find((option) => option.level === current);
          return (kept ?? quoted.options[0])?.level ?? null;
        });
      } catch (quoteError) {
        if (cancelled) return;
        captureClientException(quoteError);
        setOptions([]);
        setError(
          customerMessage(
            quoteError,
            "Shipping could not be calculated. Check your connection and try again.",
          ),
        );
      }
    })();
    // An address edited in another tab, or a step left before the quote came
    // back, must not land on a page that has moved on.
    return () => {
      cancelled = true;
    };
  }, [address, attempt, email, orderId, orderToken]);

  const chosen = options?.find((option) => option.level === level) ?? null;
  const needsConfirm = Boolean(addressWarning || suggestedAddress);

  const startPayment = async (): Promise<void> => {
    if (!level) return;
    if (hasVideoMemories && !archivalConsent) {
      setError("Please confirm the Video Memories archival notice to continue.");
      return;
    }
    if (needsConfirm && !addressAccepted) {
      setError(
        "Please confirm the shipping address suggestion (or edit your address) before paying.",
      );
      return;
    }

    setError(null);
    setBusy(true);
    try {
      // Setting up the payment saves the chosen speed with the address, so
      // coming back to this page finds it.
      const response = await fetch("/api/stripe/payment-intent", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-order-token": orderToken,
          ...postHogHeaders(),
        },
        body: JSON.stringify({
          orderId,
          email: email ?? "",
          shippingLevel: level,
          address,
          acceptedAddressWarning: needsConfirm ? true : undefined,
          archivalConsent: hasVideoMemories ? archivalConsent : undefined,
        }),
      });
      const data = (await response.json()) as {
        clientSecret?: string;
        error?: string;
      };
      if (!response.ok || !data.clientSecret) {
        throw new Error(data.error ?? "Payment could not be set up.");
      }
      router.push(next);
    } catch (paymentError) {
      captureClientException(paymentError);
      setError(
        customerMessage(
          paymentError,
          "Payment could not be set up. Check your connection and try again.",
        ),
      );
      setBusy(false);
    }
  };

  // One tap rather than a trip back to retype what is already on screen.
  const applySuggested = async (): Promise<void> => {
    if (!suggestedAddress) return;
    setBusy(true);
    setError(null);
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
          address: {
            ...address,
            street1: suggestedAddress.street1 ?? address.street1,
            street2: suggestedAddress.street2 ?? address.street2,
            city: suggestedAddress.city ?? address.city,
            state: suggestedAddress.state ?? address.state,
            postcode: suggestedAddress.postcode ?? address.postcode,
          },
        }),
      });
      if (!response.ok) throw new Error("That address could not be saved.");
      setOptions(null);
      setSuggestedAddress(null);
      setAddressWarning(null);
      router.refresh();
    } catch (saveError) {
      captureClientException(saveError);
      setError("That address could not be saved. Please edit it instead.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <StepCard title="Delivery">
      <p className="mt-2 text-sm text-ink-soft">
        To {address.name}, {address.street1}
        {address.street2 ? `, ${address.street2}` : ""}, {address.city}{" "}
        {address.state} {address.postcode}.{" "}
        <Link href={addressHref} className={linkButton}>
          Edit address
        </Link>
      </p>

      {notice ? (
        <p
          role="status"
          className="mt-3 rounded-lg border border-periwinkle/30 bg-periwinkle-wash/50 px-3 py-2 text-sm text-periwinkle-deep"
        >
          {notice}
        </p>
      ) : null}

      {addressWarning ? (
        <p className="mt-3 rounded-lg border border-periwinkle/30 bg-periwinkle-wash/50 px-3 py-2 text-sm text-periwinkle-deep">
          {addressWarning}
        </p>
      ) : null}

      {suggestedAddress ? (
        <div className="mt-3 rounded-lg border border-line bg-cloud px-3 py-3 text-sm text-ink-soft">
          <p className="font-medium text-ink">Suggested address</p>
          <p className="mt-1 leading-6">
            {[
              suggestedAddress.street1,
              suggestedAddress.street2,
              [suggestedAddress.city, suggestedAddress.state].filter(Boolean).join(", "),
              suggestedAddress.postcode,
            ]
              .filter(Boolean)
              .join(", ")}
          </p>
          <p className="mt-3">
            <button
              type="button"
              disabled={busy}
              onClick={() => void applySuggested()}
              className={linkButton}
            >
              Use this address
            </button>
          </p>
        </div>
      ) : null}

      {needsConfirm ? (
        <label className="mt-4 flex items-start gap-3 text-sm text-ink-soft">
          <input
            type="checkbox"
            checked={addressAccepted}
            onChange={(event) => setAddressAccepted(event.target.checked)}
            className="mt-1 accent-periwinkle"
          />
          <span>
            I&rsquo;ve checked this address and want to continue with it as
            entered.
          </span>
        </label>
      ) : null}

      {options === null ? (
        <p className="mt-5 text-sm text-ink-soft">Checking delivery options…</p>
      ) : options.length === 0 ? (
        <p className="mt-5 text-sm text-ink-soft">
          No delivery option came back for that address.{" "}
          <Link href={addressHref} className={linkButton}>
            Check the address
          </Link>
          .
        </p>
      ) : (
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
                    onChange={() => setLevel(option.level)}
                    className="accent-[var(--color-periwinkle)]"
                  />
                  <span>
                    <span className="block text-sm font-medium text-ink">
                      {option.label}
                    </span>
                    {option.minDeliveryDays && option.maxDeliveryDays ? (
                      <span className="block text-xs text-ink-faint">
                        About {option.minDeliveryDays}–{option.maxDeliveryDays}{" "}
                        business days, including printing
                      </span>
                    ) : null}
                  </span>
                </span>
                <span className="font-display text-lg text-ink">
                  {formatUsd(option.price)}
                </span>
              </label>
            </li>
          ))}
        </ul>
      )}

      {hasVideoMemories ? (
        <VideoMemoryDisclosure
          packCount={videoMemoryPackCount}
          videoCount={videoMemoryCount}
          price={videoMemoryPrice}
          consented={archivalConsent}
          onConsent={setArchivalConsent}
        />
      ) : null}

      {error ? (
        <p role="alert" className="mt-4 text-sm text-red-600">
          {error}
        </p>
      ) : null}
      {/* With no prices there is nothing to choose and nothing to continue
          with, and the only way forward used to be reloading the page. */}
      {error && options !== null && options.length === 0 ? (
        <button
          type="button"
          onClick={() => {
            setError(null);
            setOptions(null);
            setAttempt((count) => count + 1);
          }}
          className="mt-3 inline-flex min-h-11 items-center rounded-xl border border-line bg-white px-5 text-sm font-semibold text-ink hover:border-periwinkle"
        >
          Try again
        </button>
      ) : null}

      <button
        type="button"
        onClick={() => void startPayment()}
        disabled={
          busy ||
          !chosen ||
          (needsConfirm && !addressAccepted) ||
          (hasVideoMemories && !archivalConsent)
        }
        className={primaryButton}
      >
        {busy ? "Preparing payment…" : "Continue to payment"}
      </button>
    </StepCard>
  );
}

/** What Lulu will carry it for, and what it thinks of the address. */
async function quote(
  orderId: string,
  orderToken: string,
  email: string | null,
  address: ShippingAddress,
): Promise<{
  options: ShippingOption[];
  addressWarning: string | null;
  suggestedAddress: Partial<ShippingAddress> | null;
}> {
  const response = await fetch("/api/lulu/quote", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-order-token": orderToken,
      ...postHogHeaders(),
    },
    body: JSON.stringify({ orderId, email: email ?? "", address }),
  });
  const data = (await response.json()) as {
    options?: ShippingOption[];
    addressWarning?: string;
    suggestedAddress?: Partial<ShippingAddress>;
    error?: string;
  };
  if (!response.ok) throw new Error(data.error ?? "Shipping lookup failed.");
  return {
    options: data.options ?? [],
    addressWarning: data.addressWarning ?? null,
    suggestedAddress: data.suggestedAddress ?? null,
  };
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
      {/* Word for word as it was: this is the notice somebody consents to,
          not copy to be improved. */}
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
