import { z } from "zod";

import { routeError } from "@/lib/env";
import {
  calculatePrintJobCost,
  fetchShippingOptions,
  isOfferedShippingLevel,
  OFFERED_SHIPPING_LEVELS,
  SHIPPING_LEVEL_LABELS,
  type LuluCostCalculation,
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
  email: z.string().email().max(200),
  address: addressSchema,
});

export async function POST(request: Request): Promise<Response> {
  try {
    const parsed = requestSchema.safeParse(await request.json());
    if (!parsed.success) {
      return Response.json(
        { error: "Please check the delivery address." },
        { status: 400 },
      );
    }

    const { orderId, email, address } = parsed.data;

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
    let suggestedAddress: Partial<ShippingAddress> | undefined;

    for (const option of chosen) {
      const cost = await calculatePrintJobCost({
        pageCount: order.total_pages,
        address: address as ShippingAddress,
        shippingLevel: option.level,
        email,
      });

      const shippingPrice = Number(
        cost.shipping_cost?.total_cost_incl_tax ??
          cost.shipping_cost?.total_cost_excl_tax ??
          option.cost_excl_tax ??
          0,
      );

      const feedback = extractAddressFeedback(cost, address as ShippingAddress);
      if (!addressWarning && feedback.warning) {
        addressWarning = feedback.warning;
      }
      if (!suggestedAddress && feedback.suggested) {
        suggestedAddress = feedback.suggested;
      }

      options.push({
        level: option.level,
        label: SHIPPING_LEVEL_LABELS[option.level] ?? option.level,
        price: Math.round(shippingPrice * 100) / 100,
        minDeliveryDays: option.total_days_min,
        maxDeliveryDays: option.total_days_max,
      });
    }

    options.sort((a, b) => a.price - b.price);

    return Response.json({ options, addressWarning, suggestedAddress });
  } catch (error) {
    return routeError(error, "We could not calculate shipping for that address.");
  }
}

function cheapestPerLevel(options: LuluShippingOption[]): LuluShippingOption[] {
  const best = new Map<string, LuluShippingOption>();

  for (const option of options) {
    if (!isOfferedShippingLevel(option.level)) continue;
    const current = best.get(option.level);
    if (!current || cost(option) < cost(current)) best.set(option.level, option);
  }

  return OFFERED_SHIPPING_LEVELS.map((level) => best.get(level)).filter(
    (option): option is LuluShippingOption => option !== undefined,
  );
}

function cost(option: LuluShippingOption): number {
  return Number(option.cost_excl_tax ?? Number.MAX_SAFE_INTEGER);
}

function extractAddressFeedback(
  costResult: LuluCostCalculation,
  entered: ShippingAddress,
): {
  warning?: string;
  suggested?: Partial<ShippingAddress>;
} {
  const warningMessages = [
    ...(costResult.warnings ?? []),
    ...(costResult.shipping_address?.warnings ?? []),
  ]
    .map((item) => item.message)
    .filter((message): message is string => Boolean(message));

  const raw = costResult.shipping_address?.suggested_address;
  let suggested: Partial<ShippingAddress> | undefined;

  if (raw) {
    const candidate: Partial<ShippingAddress> = {
      street1: raw.street1 ?? undefined,
      street2: raw.street2 ?? undefined,
      city: raw.city ?? undefined,
      state: raw.state_code ?? undefined,
      postcode: raw.postcode ?? undefined,
      country: raw.country_code === "US" ? "US" : undefined,
    };

    const differs =
      (candidate.street1 && candidate.street1 !== entered.street1) ||
      (candidate.city && candidate.city !== entered.city) ||
      (candidate.state && candidate.state !== entered.state) ||
      (candidate.postcode &&
        normalizePostcode(candidate.postcode) !==
          normalizePostcode(entered.postcode));

    if (differs) suggested = candidate;
  }

  return {
    warning: warningMessages[0],
    suggested,
  };
}

function normalizePostcode(value: string): string {
  return value.replace(/\s+/g, "").toUpperCase();
}
