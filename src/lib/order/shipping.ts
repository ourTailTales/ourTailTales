import { supabaseAdmin, supabaseConfigured } from "@/lib/supabase/server";
import type { ShippingAddress } from "@/types/order";

export type SavedShipping = {
  address: ShippingAddress;
  /** Null until a delivery speed has actually been chosen. */
  level: string | null;
};

/**
 * The delivery details saved against an order.
 *
 * Saved as soon as the address is entered rather than only when the payment is
 * set up, because each step of the checkout is its own page now: the delivery
 * page has to be able to find the address the address page took, whether it
 * was reached by pressing Continue, by the back button, or by a reload.
 *
 * Server-only: an address is the one thing on an order that must never be
 * readable with an id alone.
 */
export async function readOrderShipping(
  orderId: string,
): Promise<SavedShipping | null> {
  if (!supabaseConfigured()) return null;
  if (!/^[0-9a-f-]{36}$/i.test(orderId)) return null;

  const { data, error } = await supabaseAdmin()
    .from("order_shipping")
    .select("name, phone, street1, street2, city, state, postcode, country, shipping_level")
    .eq("order_id", orderId)
    .maybeSingle();

  if (error || !data) return null;

  return {
    address: {
      name: data.name,
      phone: data.phone,
      street1: data.street1,
      street2: data.street2 ?? "",
      city: data.city,
      state: data.state,
      postcode: data.postcode,
      country: data.country as ShippingAddress["country"],
    },
    // The column cannot be null, so "not chosen yet" is written as an empty
    // string and read back as what it means.
    level: data.shipping_level ? data.shipping_level : null,
  };
}
