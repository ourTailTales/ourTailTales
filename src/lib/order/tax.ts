import { readEnv } from "@/lib/env";
import { alertOps } from "@/lib/ops/alert";
import { stripeClient } from "@/lib/stripe";

/**
 * US sales tax, worked out by Stripe Tax.
 *
 * Sales tax in the United States is set by the state, county and city a book
 * is delivered to, and it is only owed in a state where the business is
 * registered to collect it. Stripe Tax holds both halves: the rates, and the
 * list of states the account is registered in. Asked about an address in a
 * state with no registration it answers zero, so turning this on collects
 * nothing until a registration is added in the Stripe dashboard, and then
 * starts collecting for that state with no change here.
 *
 * Off unless `STRIPE_TAX_ENABLED` is "true". Stripe Tax has to be set up on
 * the account first (an origin address and at least one registration), and it
 * is billed per transaction.
 */

/** General tangible goods. A printed, bound book made to order. */
const DEFAULT_HARDCOVER_TAX_CODE = "txcd_99999999";

/** Digital books, downloaded, with permanent rights. */
const DEFAULT_DIGITAL_TAX_CODE = "txcd_10302000";

export function salesTaxEnabled(): boolean {
  return readEnv("STRIPE_TAX_ENABLED") === "true";
}

/** Stripe's product tax code for the hardcover. */
export function hardcoverTaxCode(): string {
  return readEnv("STRIPE_TAX_CODE_HARDCOVER") ?? DEFAULT_HARDCOVER_TAX_CODE;
}

/**
 * Stripe's product tax code for the PDF: a digital book, downloaded, kept for
 * good. Named here because the account's default code is for physical goods,
 * and states tax the two differently.
 */
export function digitalTaxCode(): string {
  return readEnv("STRIPE_TAX_CODE_DIGITAL") ?? DEFAULT_DIGITAL_TAX_CODE;
}

export type SalesTax = {
  /** Tax to add to the order, in cents. */
  amountCents: number;
  /** The Stripe Tax calculation it came from. Null when nothing was asked. */
  calculationId: string | null;
};

export const NO_SALES_TAX: SalesTax = { amountCents: 0, calculationId: null };

export type TaxableOrder = {
  orderId: string;
  /** Every copy together, plus any Video Memories, in cents. */
  goodsCents: number;
  shippingCents: number;
  address: {
    street1: string;
    street2?: string | null;
    city: string;
    state: string;
    postcode: string;
  };
};

/**
 * The sales tax on a hardcover delivered to this address.
 *
 * Never throws and never blocks a sale. If Stripe Tax cannot answer, the order
 * goes ahead with no tax and a person is told, because a customer turned away
 * at the last step costs more than the tax on one book, which can be paid
 * from the sale.
 */
export async function calculateSalesTax(order: TaxableOrder): Promise<SalesTax> {
  if (!salesTaxEnabled()) return NO_SALES_TAX;
  if (order.goodsCents <= 0) return NO_SALES_TAX;

  try {
    const calculation = await stripeClient().tax.calculations.create({
      currency: "usd",
      line_items: [
        {
          amount: order.goodsCents,
          reference: "hardcover",
          tax_behavior: "exclusive",
          tax_code: hardcoverTaxCode(),
        },
      ],
      shipping_cost: {
        amount: order.shippingCents,
        tax_behavior: "exclusive",
      },
      customer_details: {
        address: {
          line1: order.address.street1,
          line2: order.address.street2 || undefined,
          city: order.address.city,
          state: order.address.state.toUpperCase(),
          postal_code: order.address.postcode,
          country: "US",
        },
        address_source: "shipping",
      },
    });

    if (!calculation.id) return NO_SALES_TAX;
    return {
      amountCents: Math.max(0, calculation.tax_amount_exclusive),
      calculationId: calculation.id,
    };
  } catch (error) {
    await alertOps("Sales tax could not be calculated for an order", {
      order: order.orderId,
      error: error instanceof Error ? error.message : String(error),
      note: "The order was allowed to go ahead with no sales tax. Check that Stripe Tax is set up on the account, or set STRIPE_TAX_ENABLED=false.",
    });
    return NO_SALES_TAX;
  }
}

/**
 * Records the tax on a paid order with Stripe Tax, so it appears in the
 * reports a return is filed from. Returns the transaction's id, or null when
 * there was nothing to record or it could not be recorded.
 *
 * Safe to call again for the same order: Stripe keys the transaction on the
 * reference, and a repeat is answered with the one already made.
 */
export async function recordSalesTax(args: {
  orderId: string;
  calculationId: string | null;
}): Promise<string | null> {
  if (!args.calculationId) return null;
  try {
    const transaction = await stripeClient().tax.transactions.createFromCalculation(
      { calculation: args.calculationId, reference: taxReference(args.orderId) },
      { idempotencyKey: `order-tax-${args.orderId}` },
    );
    return transaction.id;
  } catch (error) {
    await alertOps("Sales tax was charged but could not be recorded", {
      order: args.orderId,
      calculation: args.calculationId,
      error: error instanceof Error ? error.message : String(error),
      note: "The customer paid the tax. Add it to the Stripe Tax records by hand so it is included when the return is filed.",
    });
    return null;
  }
}

/**
 * Takes a fully refunded order's tax back out of Stripe's records. Best
 * effort: the refund itself has already happened.
 */
export async function reverseSalesTax(args: {
  orderId: string;
  transactionId: string | null;
}): Promise<void> {
  if (!args.transactionId) return;
  try {
    await stripeClient().tax.transactions.createReversal(
      {
        mode: "full",
        original_transaction: args.transactionId,
        reference: `${taxReference(args.orderId)}-refund`,
      },
      { idempotencyKey: `order-tax-refund-${args.orderId}` },
    );
  } catch (error) {
    await alertOps("A refunded order's sales tax could not be reversed", {
      order: args.orderId,
      transaction: args.transactionId,
      error: error instanceof Error ? error.message : String(error),
      note: "Reverse the tax transaction in Stripe by hand so the refunded tax is not paid over.",
    });
  }
}

function taxReference(orderId: string): string {
  return `order-${orderId}`;
}
