import type { Metadata } from "next";

import { AddressStep } from "@/components/checkout/AddressStep";
import { CheckoutRefused } from "@/components/checkout/CheckoutRefused";
import { CheckoutShell } from "@/components/checkout/CheckoutShell";
import { OrderSummary } from "@/components/checkout/OrderSummary";
import { salesTaxEnabled } from "@/lib/order/tax";
import { checkoutAccess, stepHref } from "@/lib/order/checkout-access";

export const metadata: Metadata = {
  title: "Delivery address | ourTailTales",
  robots: { index: false, follow: false },
};

export default async function CheckoutAddressPage({
  searchParams,
}: PageProps<"/checkout/address">) {
  const access = await checkoutAccess(await searchParams);
  if (!access.ok) return <CheckoutRefused reason={access.reason} orderHref={access.orderHref} />;

  const { order, token, shipping } = access;

  return (
    <CheckoutShell
      current="address"
      href={(step) => stepHref(step, order.id, token)}
      aside={
        <OrderSummary
          order={order}
          shippingPrice={order.shippingPrice}
          taxMayApply={salesTaxEnabled()}
        />
      }
    >
      <AddressStep
        orderId={order.id}
        orderToken={token}
        email={order.email}
        unitPrice={order.bookPrice}
        quantity={order.quantity}
        address={shipping?.address ?? null}
        next={stepHref("shipping", order.id, token)}
      />
    </CheckoutShell>
  );
}
