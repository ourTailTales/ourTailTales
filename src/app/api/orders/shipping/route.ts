import { z } from "zod";

import { routeError } from "@/lib/env";
import { isOfferedShippingLevel } from "@/lib/lulu/client";
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

    const { orderId, email, address, level } = parsed.data;
    const unauthorized = requireOrderToken(request, orderId);
    if (unauthorized) return unauthorized;

    const supabase = supabaseAdmin();
    const { data: order } = await supabase
      .from("orders")
      .select("status")
      .eq("id", orderId)
      .maybeSingle();

    if (!order) {
      return Response.json({ error: "Unknown order." }, { status: 404 });
    }
    if (order.status !== "pending_payment") {
      return Response.json(
        { error: "This order is already on its way." },
        { status: 409 },
      );
    }

    const { data: saved } = await supabase
      .from("order_shipping")
      .select(
        "name, phone, street1, street2, city, state, postcode, country, shipping_level",
      )
      .eq("order_id", orderId)
      .maybeSingle();

    if (!address && !saved) {
      return Response.json(
        { error: "Add a delivery address first." },
        { status: 409 },
      );
    }

    const next = address
      ? {
          name: address.name,
          phone: address.phone,
          street1: address.street1,
          street2: address.street2 || null,
          city: address.city,
          state: address.state.toUpperCase(),
          postcode: address.postcode,
          country: address.country,
        }
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

    if (email) {
      const { error: emailError } = await supabase
        .from("orders")
        .update({ email: email.toLowerCase().trim() })
        .eq("id", orderId);
      if (emailError) throw new Error(emailError.message);
    }

    return Response.json({ ok: true });
  } catch (error) {
    return routeError(error, "Those delivery details could not be saved.");
  }
}
