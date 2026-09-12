import { z } from "zod";

import { routeError } from "@/lib/env";
import {
  calculatePrintJobCost,
  fetchShippingOptions,
  type LuluShippingOption,
} from "@/lib/lulu/client";
import { supabaseAdmin } from "@/lib/supabase/server";
import type { ShippingAddress, ShippingOption } from "@/types/order";

/**
 * Shipping quote for one order.
 *
 * Only the customer's shipping price is ever returned. Lulu's manufacturing
 * cost stays on the server.
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
  address: addressSchema,
});

/** A short, understandable set rather than every carrier permutation. */
const OFFERED_LEVELS = ["MAIL", "GROUND", "EXPEDITED"] as const;

const LEVEL_LABELS: Record<string, string> = {
  MAIL: "Standard post",
  GROUND: "Ground",
  EXPEDITED: "Expedited",
};

export async function POST(request: Request): Promise<Response> {
  try {
    const parsed = requestSchema.safeParse(await request.json());
    if (!parsed.success) {
      return Response.json(
        { error: "Please check the delivery address." },
        { status: 400 },
      );
    }

    const { orderId, address } = parsed.data;

    const { data: order, error } = await supabaseAdmin()
      .from("orders")
      .select("id, total_pages, status")
      .eq("id", orderId)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!order) {
      return Response.json({ error: "Unknown order." }, { status: 404 });
    }

    const available = await fetchShippingOptions(
      order.total_pages,
      address as ShippingAddress,
    );

    const chosen = cheapestPerLevel(available);
    if (chosen.length === 0) {
      return Response.json(
        {
          error:
            "We could not find a delivery option for that address. Please double-check it.",
        },
        { status: 422 },
      );
    }

    const options: ShippingOption[] = [];
    let addressWarning: string | undefined;

    for (const option of chosen) {
      const cost = await calculatePrintJobCost({
        pageCount: order.total_pages,
        address: address as ShippingAddress,
        shippingLevel: option.level,
      });

      const shippingPrice = Number(
        cost.shipping_cost?.total_cost_incl_tax ??
          cost.shipping_cost?.total_cost_excl_tax ??
          option.cost_excl_tax ??
          0,
      );

      const warnings = (cost as { warnings?: { message?: string }[] }).warnings;
      if (!addressWarning && warnings?.[0]?.message) {
        addressWarning = warnings[0].message;
      }

      options.push({
        level: option.level,
        label: LEVEL_LABELS[option.level] ?? option.level,
        price: Math.round(shippingPrice * 100) / 100,
        minDeliveryDays: option.total_days_min,
        maxDeliveryDays: option.total_days_max,
      });
    }

    options.sort((a, b) => a.price - b.price);

    return Response.json({ options, addressWarning });
  } catch (error) {
    return routeError(error, "We could not calculate shipping for that address.");
  }
}

function cheapestPerLevel(options: LuluShippingOption[]): LuluShippingOption[] {
  const best = new Map<string, LuluShippingOption>();

  for (const option of options) {
    if (!OFFERED_LEVELS.includes(option.level as (typeof OFFERED_LEVELS)[number])) {
      continue;
    }
    const current = best.get(option.level);
    if (!current || cost(option) < cost(current)) best.set(option.level, option);
  }

  return OFFERED_LEVELS.map((level) => best.get(level)).filter(
    (option): option is LuluShippingOption => option !== undefined,
  );
}

function cost(option: LuluShippingOption): number {
  return Number(option.cost_excl_tax ?? Number.MAX_SAFE_INTEGER);
}
