import { z } from "zod";

import { routeError } from "@/lib/env";
import { calculatePrintJobCost } from "@/lib/lulu/client";
import { bookPrice } from "@/lib/pricing";
import { stripeClient, toMinorUnits } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabase/server";
import type { ShippingAddress } from "@/types/order";

/**
 * Locks the quote and creates the PaymentIntent.
 *
 * Both the book price and the shipping price are recalculated here. Nothing the
 * browser sends about money is trusted, and no fulfilment happens on this path
 * — only the Stripe webhook may submit a print job.
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
  email: z.string().email().max(200),
  shippingLevel: z.enum(["MAIL", "GROUND", "EXPEDITED"]),
  address: addressSchema,
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

    const { orderId, email, shippingLevel, address } = parsed.data;
    const supabase = supabaseAdmin();

    const { data: order, error } = await supabase
      .from("orders")
      .select(
        "id, chapter_count, total_pages, status, stripe_payment_intent_id, interior_path, cover_path, lulu_print_job_id",
      )
      .eq("id", orderId)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!order) {
      return Response.json({ error: "Unknown order." }, { status: 404 });
    }
    if (order.lulu_print_job_id) {
      return Response.json(
        { error: "This book has already been sent to print." },
        { status: 409 },
      );
    }
    if (!order.interior_path || !order.cover_path) {
      return Response.json(
        { error: "Your print files are still uploading. Please try again." },
        { status: 409 },
      );
    }

    const cost = await calculatePrintJobCost({
      pageCount: order.total_pages,
      address: address as ShippingAddress,
      shippingLevel,
    });

    const shippingPrice =
      Math.round(
        Number(
          cost.shipping_cost?.total_cost_incl_tax ??
            cost.shipping_cost?.total_cost_excl_tax ??
            0,
        ) * 100,
      ) / 100;

    const book = bookPrice(order.chapter_count);
    const amount = toMinorUnits(book + shippingPrice);

    const stripe = stripeClient();
    const paymentIntent = order.stripe_payment_intent_id
      ? await stripe.paymentIntents.update(order.stripe_payment_intent_id, {
          amount,
          receipt_email: email,
          metadata: { orderId, shippingLevel },
        })
      : await stripe.paymentIntents.create({
          amount,
          currency: "usd",
          // Let Stripe decide which methods to show for this account.
          automatic_payment_methods: { enabled: true },
          receipt_email: email,
          description: `ourTailTales hardcover — ${order.chapter_count} chapters`,
          metadata: { orderId, shippingLevel },
        });

    const { error: orderUpdateError } = await supabase
      .from("orders")
      .update({
        email: email.toLowerCase().trim(),
        shipping_price: shippingPrice,
        stripe_payment_intent_id: paymentIntent.id,
      })
      .eq("id", orderId);

    if (orderUpdateError) throw new Error(orderUpdateError.message);

    const { error: shippingError } = await supabase
      .from("order_shipping")
      .upsert(
        {
          order_id: orderId,
          name: address.name,
          phone: address.phone,
          street1: address.street1,
          street2: address.street2 || null,
          city: address.city,
          state: address.state.toUpperCase(),
          postcode: address.postcode,
          country: address.country,
          shipping_level: shippingLevel,
        },
        { onConflict: "order_id" },
      );

    if (shippingError) throw new Error(shippingError.message);

    return Response.json({
      clientSecret: paymentIntent.client_secret,
      bookPrice: book,
      shippingPrice,
      total: book + shippingPrice,
    });
  } catch (error) {
    return routeError(error, "Payment could not be set up.");
  }
}
