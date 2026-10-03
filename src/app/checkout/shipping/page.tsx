import { redirect } from "next/navigation";
import type { Metadata } from "next";

import { CheckoutRefused } from "@/components/checkout/CheckoutRefused";
import { CheckoutShell } from "@/components/checkout/CheckoutShell";
import { OrderSummary } from "@/components/checkout/OrderSummary";
import { ShippingStep } from "@/components/checkout/ShippingStep";
import { checkoutAccess, stepHref } from "@/lib/order/checkout-access";

export const metadata: Metadata = {
  title: "Delivery | ourTailTales",
  robots: { index: false, follow: false },
};

export default async function CheckoutShippingPage({
  searchParams,
}: PageProps<"/checkout/shipping">) {
  const params = await searchParams;
  const access = await checkoutAccess(params);
  if (!access.ok) {
    return <CheckoutRefused reason={access.reason} orderHref={access.orderHref} />;
  }

  const { order, token, shipping } = access;

  // Nothing to quote against. A link straight here, or an order whose address
  // was never taken, starts where it should have started.
  if (!shipping) redirect(stepHref("address", order.id, token));

  return (
    <CheckoutShell
      current="shipping"
      href={(step) => stepHref(step, order.id, token)}
      aside={<OrderSummary order={order} shippingPrice={order.shippingPrice} />}
    >
      <ShippingStep
        orderId={order.id}
        orderToken={token}
        address={shipping.address}
        savedLevel={shipping.level}
        email={order.email}
        hasVideoMemories={order.hasVideoMemories}
        videoMemoryPackCount={order.videoMemoryPackCount}
        videoMemoryCount={order.selectedVideoCount}
        videoMemoryPrice={order.videoMemoryPrice}
        addressHref={stepHref("address", order.id, token)}
        next={stepHref("payment", order.id, token)}
        // Set by the payment page when it sends somebody back rather than
        // take a payment whose amount is out of date.
        notice={
          params.changed === "1"
            ? "Your order details changed. Please confirm delivery again before you pay."
            : null
        }
      />
    </CheckoutShell>
  );
}
