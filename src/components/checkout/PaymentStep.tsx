"use client";

import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { loadStripe, type Stripe } from "@stripe/stripe-js";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { StepCard, linkButton, primaryButton } from "@/components/checkout/ui";
import { captureClientException, track } from "@/lib/analytics";
import { brand } from "@/lib/brand";
import { formatUsd } from "@/lib/pricing";

/** The last step: the card, and nothing else to decide. */
export function PaymentStep({
  orderId,
  orderToken,
  total,
  clientSecret,
  publishableKey,
  shippingHref,
}: {
  orderId: string;
  orderToken: string;
  total: number;
  clientSecret: string;
  publishableKey: string | null;
  shippingHref: string;
}) {
  const stripePromise = useMemo<Promise<Stripe | null> | null>(
    () => (publishableKey ? loadStripe(publishableKey) : null),
    [publishableKey],
  );

  if (!stripePromise) {
    return (
      <StepCard title="Payments are not connected yet">
        <p className="mt-3 text-sm leading-6 text-ink-soft">
          Add{" "}
          <code className="text-periwinkle-deep">
            NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
          </code>{" "}
          to <code className="text-periwinkle-deep">.env.local</code> to take
          payments.
        </p>
      </StepCard>
    );
  }

  return (
    <StepCard title="Payment">
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
        <PayForm
          orderId={orderId}
          orderToken={orderToken}
          total={total}
          shippingHref={shippingHref}
        />
      </Elements>
      <p className="mt-4">
        <Link href={shippingHref} className={linkButton}>
          Change delivery
        </Link>
      </p>
    </StepCard>
  );
}

function PayForm({
  orderId,
  orderToken,
  total,
  shippingHref,
}: {
  orderId: string;
  orderToken: string;
  total: number;
  shippingHref: string;
}) {
  // The order page refuses a link without the token.
  const orderPath = `/order/${orderId}?t=${encodeURIComponent(orderToken)}`;
  const stripe = useStripe();
  const elements = useElements();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pay = async (): Promise<void> => {
    if (!stripe || !elements) return;
    setBusy(true);
    setError(null);

    // Asked the moment before charging. This page can be open, or come back
    // from the browser's cache, after the address or the number of copies was
    // changed somewhere else. The amount it holds is then out of date, and
    // paying it would put the order on hold.
    const check = await orderPayable(orderId, orderToken);
    const payable = check === null ? null : check.payable;
    if (payable === null) {
      setBusy(false);
      setError("We could not check your order. You have not been charged. Please try again.");
      return;
    }
    if (!payable) {
      setError("Your order details changed. Taking you back to confirm delivery.");
      router.replace(`${shippingHref}&changed=1`);
      return;
    }
    // The button must show what will be charged. A page the Back button
    // restored can be showing a total from before delivery was changed.
    if (check !== null && check.amountCents !== null && check.amountCents !== Math.round(total * 100)) {
      setBusy(false);
      setError("Your total has changed. We have updated this page. Please check the amount and pay again.");
      router.refresh();
      return;
    }

    const { error: confirmError } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}${orderPath}`,
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
    router.push(orderPath);
  };

  return (
    <div className="mt-5">
      <PaymentElement
        // Cards only. The payment is created for cards, but Link adds its own
        // "Bank" and pay-later tabs to the form unless it is told not to, and
        // a bank debit can bounce after the book has been printed.
        options={{ wallets: { link: "never" } }}
        onLoadError={() =>
          setError(
            "The card form could not load. Reload this page, or turn off any content blocker for this site.",
          )
        }
      />
      <button
        type="button"
        onClick={() => void pay()}
        disabled={busy || !stripe}
        className={primaryButton}
      >
        {busy ? "Processing…" : `Pay ${formatUsd(total)}`}
      </button>
      {error ? (
        <p role="alert" className="mt-3 text-sm text-red-700">
          {error}
        </p>
      ) : null}
      <p className="mt-3 text-xs leading-5 text-ink-faint">
        We only start printing once your payment is confirmed. If the book
        arrives damaged or misprinted, tell us within 30 days of delivery and
        we reprint it free. By paying you agree to our{" "}
        <Link href="/terms" className="underline underline-offset-2">
          Terms
        </Link>
        .
      </p>
    </div>
  );
}

/**
 * Whether the payment on this page still matches the order. Null when the
 * question could not be answered, which is not a yes.
 */
async function orderPayable(
  orderId: string,
  orderToken: string,
): Promise<{ payable: boolean; amountCents: number | null } | null> {
  try {
    const response = await fetch(
      `/api/orders/payable?orderId=${encodeURIComponent(orderId)}`,
      { headers: { "x-order-token": orderToken }, cache: "no-store" },
    );
    if (!response.ok) return null;
    const data = (await response.json()) as {
      payable?: boolean;
      amountCents?: number | null;
    };
    return {
      payable: data.payable === true,
      amountCents: typeof data.amountCents === "number" ? data.amountCents : null,
    };
  } catch (error) {
    captureClientException(error);
    return null;
  }
}
