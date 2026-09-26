import { redirect } from "next/navigation";
import type { Metadata } from "next";

import { CheckoutRefused } from "@/components/checkout/CheckoutRefused";
import { CheckoutShell } from "@/components/checkout/CheckoutShell";
import { OrderSummary } from "@/components/checkout/OrderSummary";
import { PaymentStep } from "@/components/checkout/PaymentStep";
import { readEnv } from "@/lib/env";
import { checkoutAccess, stepHref } from "@/lib/order/checkout-access";
import { readPaymentClientSecret } from "@/lib/order/payment-intent";

export const metadata: Metadata = {
  title: "Payment | ourTailTales",
  robots: { index: false, follow: false },
};

export default async function CheckoutPaymentPage({
  searchParams,
}: PageProps<"/checkout/payment">) {
  const access = await checkoutAccess(await searchParams);
  if (!access.ok) {
    return <CheckoutRefused reason={access.reason} />;
  }

  const { order, token, shipping } = access;
  if (!shipping) redirect(stepHref("address", order.id, token));

  // The intent is made when the delivery step is left, and it carries the
  // amount. Without one there is nothing to pay against, so the customer goes
  // back to the step that creates it rather than to an empty card field.
  const clientSecret = await readPaymentClientSecret(order.id);
  if (!clientSecret) redirect(stepHref("shipping", order.id, token));

  const total =
    order.bookPrice + order.videoMemoryPrice + (order.shippingPrice ?? 0);

  return (
    <CheckoutShell
      current="payment"
      href={(step) => stepHref(step, order.id, token)}
      aside={<OrderSummary order={order} shippingPrice={order.shippingPrice} />}
    >
      <PaymentStep
        orderId={order.id}
        total={total}
        clientSecret={clientSecret}
        publishableKey={readEnv("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY") ?? null}
        shippingHref={stepHref("shipping", order.id, token)}
      />
    </CheckoutShell>
  );
}
