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
  total,
  clientSecret,
  publishableKey,
  shippingHref,
}: {
  orderId: string;
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
        <PayForm orderId={orderId} total={total} />
      </Elements>
      <p className="mt-4">
        <Link href={shippingHref} className={linkButton}>
          Change delivery
        </Link>
      </p>
    </StepCard>
  );
}

function PayForm({ orderId, total }: { orderId: string; total: number }) {
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
      {error ? (
        <p role="alert" className="mt-3 text-sm text-periwinkle-deep">
          {error}
        </p>
      ) : null}
      <p className="mt-3 text-xs text-ink-faint">
        We only start printing once your payment is confirmed.
      </p>
    </div>
  );
}
