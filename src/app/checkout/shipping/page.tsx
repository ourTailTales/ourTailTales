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
  const access = await checkoutAccess(await searchParams);
  if (!access.ok) {
    return <CheckoutRefused reason={access.reason} />;
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
      />
    </CheckoutShell>
  );
}
