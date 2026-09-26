import { redirect } from "next/navigation";
import type { Metadata } from "next";

import { CheckoutRefused } from "@/components/checkout/CheckoutRefused";
import {
  checkoutAccess,
  furthestStep,
  stepHref,
} from "@/lib/order/checkout-access";
import { readPaymentClientSecret } from "@/lib/order/payment-intent";

export const metadata: Metadata = {
  title: "Checkout | ourTailTales",
  robots: { index: false, follow: false },
};

/**
 * The checkout, which is three pages now.
 *
 * This link is the one already printed in emails and handed out by
 * `prepareOrder`, so it keeps working and sends the customer to the step they
 * had reached rather than back to the first one.
 */
export default async function CheckoutPage({
  searchParams,
}: PageProps<"/checkout">) {
  const access = await checkoutAccess(await searchParams);
  if (!access.ok) {
    return <CheckoutRefused reason={access.reason} />;
  }

  const { order, token, shipping } = access;
  const hasIntent = Boolean(await readPaymentClientSecret(order.id));
  redirect(stepHref(furthestStep(shipping, hasIntent), order.id, token));
}
