import { routeError } from "@/lib/env";
import { requireOrderToken } from "@/lib/order/token";
import { supabaseAdmin } from "@/lib/supabase/server";

/**
 * Whether the payment this order's page is holding may still be taken.
 *
 * Asked by the payment page the moment before it charges. The amount on a
 * payment is fixed when delivery is chosen, and a payment page can sit open,
 * or come back from the browser's cache, long after the address or the number
 * of copies was changed in another tab. Paying then takes the old amount for
 * an order that now costs something else, and the book is held for review.
 *
 * Requires the order's token. Says only yes or no.
 */
export async function GET(request: Request): Promise<Response> {
  try {
    const orderId = new URL(request.url).searchParams.get("orderId") ?? "";
    if (!/^[0-9a-f-]{36}$/i.test(orderId)) {
      return Response.json({ error: "Unknown order." }, { status: 404 });
    }

    const unauthorized = requireOrderToken(request, orderId);
    if (unauthorized) return unauthorized;

    const { data: order, error } = await supabaseAdmin()
      .from("orders")
      .select("status, shipping_price, stripe_payment_intent_id")
      .eq("id", orderId)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!order) {
      return Response.json({ error: "Unknown order." }, { status: 404 });
    }

    const payable =
      order.status === "pending_payment" &&
      order.shipping_price !== null &&
      Boolean(order.stripe_payment_intent_id);

    return Response.json(
      { payable },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return routeError(error, "This order could not be checked.");
  }
}
