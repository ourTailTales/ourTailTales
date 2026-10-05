import { z } from "zod";

import { routeError } from "@/lib/env";
import { isOfferedShippingLevel } from "@/lib/lulu/client";
import { MAX_COPIES } from "@/lib/pricing";
import {
  normaliseAddress,
  shippingDetailsChanged,
} from "@/lib/order/shipping-change";
import { requireOrderToken } from "@/lib/order/token";
import { supabaseAdmin } from "@/lib/supabase/server";

/**
 * Where the book is going, saved between the steps of the checkout.
 *
 * Each step is its own page now, so what one step collects has to outlive the
 * navigation to the next. This writes nothing that decides money: the price of
 * the level chosen here is recalculated from Lulu when the payment is set up,
 * exactly as before, and an order that is no longer waiting to be paid for
 * cannot be touched.
 *
 * The price is locked when the payment is set up, so a change made here after
 * that point unlocks it again: the stored shipping price is cleared, the
 * payment page sends the customer back through delivery, and the payment
 * webhook refuses to print an order whose paid amount does not match what the
 * order now costs. Before this, the delivery speed or the address could be
 * changed after the amount was fixed and the book went out at the new speed
 * for the old price. Only a save that changes the address, the speed or the
 * number of copies unlocks it; one that sends the same details back does not.
 *
 * Requires the order's token. An address is the one thing on an order that an
 * id alone must never be enough to change: without it, knowing an order id
 * would be enough to redirect somebody else's book to a different doorstep.
 */
const addressSchema = z.object({
  name: z.string().min(1).max(120),
  phone: z.string().min(7).max(20),
  street1: z.string().min(1).max(200),
  street2: z.string().max(200).optional().default(""),
  city: z.string().min(1).max(120),
  state: z.string().min(2).max(3),
  postcode: z.string().min(3).max(12),
  country: z.literal("US"),
});

const requestSchema = z.object({
  orderId: z.string().uuid(),
  email: z.string().email().max(200).optional(),
  address: addressSchema.optional(),
  level: z
    .string()
    .min(2)
    .max(32)
    .refine(isOfferedShippingLevel, "Unsupported shipping level.")
    .optional(),
  /** Copies of the book. Changes the parcel, so it is settled before a quote. */
  quantity: z.number().int().min(1).max(MAX_COPIES).optional(),
});

export async function POST(request: Request): Promise<Response> {
  try {
    const parsed = requestSchema.safeParse(await request.json());
    if (!parsed.success) {
      return Response.json(
        { error: "Please check your details and try again." },
        { status: 400 },
      );
    }

    const { orderId, email, address, level, quantity } = parsed.data;
    const unauthorized = requireOrderToken(request, orderId);
    if (unauthorized) return unauthorized;

    const supabase = supabaseAdmin();
    const { data: order, error: orderReadError } = await supabase
      .from("orders")
      .select("status, quantity")
      .eq("id", orderId)
      .maybeSingle();

    // A database that could not answer is not an order that does not exist.
    if (orderReadError) throw new Error(orderReadError.message);
    if (!order) {
      return Response.json({ error: "Unknown order." }, { status: 404 });
    }
    if (order.status !== "pending_payment") {
      return Response.json(
        { error: "This order is already on its way." },
        { status: 409 },
      );
    }

    const { data: saved, error: savedError } = await supabase
      .from("order_shipping")
      .select(
        "name, phone, street1, street2, city, state, postcode, country, shipping_level",
      )
      .eq("order_id", orderId)
      .maybeSingle();
    if (savedError) throw new Error(savedError.message);

    if (!address && !saved) {
      return Response.json(
        { error: "Add a delivery address first." },
        { status: 409 },
      );
    }

    const next = address
      ? normaliseAddress(address)
      : {
          name: saved!.name,
          phone: saved!.phone,
          street1: saved!.street1,
          street2: saved!.street2,
          city: saved!.city,
          state: saved!.state,
          postcode: saved!.postcode,
          country: saved!.country,
        };

    // Decided before anything is written, against what is stored now.
    const changed = shippingDetailsChanged(
      {
        address: saved ?? null,
        level: saved?.shipping_level ?? null,
        quantity: order.quantity,
      },
      { address, level, quantity },
    );

    // The price is unlocked first and the details saved second. The other way
    // round, a failure between the two left the new address saved against the
    // old locked price, and a retry then saw nothing to change.
    const orderPatch: Record<string, string | number | null> = {};
    if (email) orderPatch.email = email.toLowerCase().trim();
    if (quantity) orderPatch.quantity = quantity;
    // A real change makes a locked amount stale, so the price is unlocked and
    // the payment page sends the customer back through delivery. Written
    // whether or not a payment has been set up yet: a payment being set up at
    // this same moment would otherwise lock a price for the old details. A
    // save that changes nothing leaves the price alone, so walking back
    // through the address step cannot strand a payment page that is open.
    if (changed) {
      orderPatch.shipping_price = null;
      // Sales tax was worked out on the same details, so it goes with it.
      orderPatch.tax_price = null;
      orderPatch.tax_calculation_id = null;
    }

    if (Object.keys(orderPatch).length > 0) {
      const { data: touched, error: orderError } = await supabase
        .from("orders")
        .update(orderPatch)
        .eq("id", orderId)
        .eq("status", "pending_payment")
        .select("id");
      if (orderError) throw new Error(orderError.message);
      // Paid in the moment between the read above and this write. The new
      // details must not be saved onto an order that has just been charged.
      if (!touched || touched.length === 0) {
        return Response.json(
          { error: "This order is already on its way." },
          { status: 409 },
        );
      }
    }

    const { error: shippingError } = await supabase
      .from("order_shipping")
      .upsert(
        {
          order_id: orderId,
          ...next,
          // The column cannot be null, so "not chosen yet" is an empty string.
          // A save that carries no level leaves whatever was chosen before.
          shipping_level: level ?? saved?.shipping_level ?? "",
        },
        { onConflict: "order_id" },
      );
    if (shippingError) throw new Error(shippingError.message);

    return Response.json({ ok: true });
  } catch (error) {
    return routeError(error, "Those delivery details could not be saved.");
  }
}
