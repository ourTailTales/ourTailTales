import { z } from "zod";

import { routeError } from "@/lib/env";
import { requireOrderToken } from "@/lib/order/token";
import {
  captureServerEvent,
  captureServerException,
  postHogDistinctId,
} from "@/lib/posthog-server";
import {
  calculatePrintJobCost,
  isOfferedShippingLevel,
} from "@/lib/lulu/client";
import { bookPrice } from "@/lib/pricing";
import { stripeClient, toMinorUnits } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabase/server";
import type { ShippingAddress } from "@/types/order";
import { videosEligibleForArchival } from "@/lib/archival/can-archive";
import { estimatePermanentStorageCost } from "@/lib/archival/turbo";
import {
  STORAGE_UNAVAILABLE_MESSAGE,
  VIDEO_MEMORY_MAX_STORAGE_COST_RATIO,
} from "@/lib/video-memory/config";
import { centsToUsd, videoMemoryQuote } from "@/lib/video-memory/pricing";
import type { FrozenBookRevision } from "@/types/video-memory";

/**
 * Locks the quote and creates the PaymentIntent.
 *
 * Both the book price and the shipping price are recalculated here. Nothing the
 * browser sends about money is trusted, and no fulfilment happens on this path:
 * only the Stripe webhook may submit a print job.
 *
 * Requires the order's token, because this writes the email and the shipping
 * address onto the order. Without it, an order id was enough to redirect
 * somebody else's book to a different doorstep.
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
  shippingLevel: z
    .string()
    .min(2)
    .max(32)
    .refine(isOfferedShippingLevel, "Unsupported shipping level."),
  address: addressSchema,
  /** Required when Lulu returned an address warning or suggested correction. */
  acceptedAddressWarning: z.boolean().optional(),
  archivalConsent: z.boolean().optional(),
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

    const unauthorized = requireOrderToken(request, parsed.data.orderId);
    if (unauthorized) return unauthorized;

    const {
      orderId,
      email,
      shippingLevel,
      address,
      acceptedAddressWarning,
      archivalConsent,
    } = parsed.data;
    const supabase = supabaseAdmin();
    const distinctId = postHogDistinctId(request, orderId);
    const sessionId = request.headers.get("x-posthog-session-id");
    const analyticsMetadata = {
      orderId,
      shippingLevel,
      posthogDistinctId: distinctId,
      ...(sessionId ? { posthogSessionId: sessionId } : {}),
    };

    const { data: order, error } = await supabase
      .from("orders")
      .select(
        "id, chapter_count, total_pages, status, stripe_payment_intent_id, interior_path, cover_path, frozen_interior_path, book_snapshot, lulu_print_job_id",
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
    const revision = order.book_snapshot as FrozenBookRevision | null;
    const placedVideos = revision ? videosEligibleForArchival(revision) : [];
    const quote = videoMemoryQuote(placedVideos.length);

    if (quote.includedUniqueVideoCount > 0) {
      if (!order.frozen_interior_path || !order.cover_path || !revision) {
        return Response.json(
          { error: "Your book is still being prepared. Please try again." },
          { status: 409 },
        );
      }
      if (!archivalConsent) {
        return Response.json(
          { error: "Please confirm the Video Memories archival notice to continue." },
          { status: 400 },
        );
      }
    } else if (!order.interior_path || !order.cover_path) {
      return Response.json(
        { error: "Your print files are still uploading. Please try again." },
        { status: 409 },
      );
    }

    const cost = await calculatePrintJobCost({
      pageCount: order.total_pages,
      address: address as ShippingAddress,
      shippingLevel,
      email,
    });

    const needsAddressConfirm = addressNeedsConfirmation(
      cost,
      address as ShippingAddress,
    );
    if (needsAddressConfirm && !acceptedAddressWarning) {
      return Response.json(
        {
          error:
            "Please confirm or update the suggested shipping address before paying.",
        },
        { status: 422 },
      );
    }

    const shippingPrice =
      Math.round(
        Number(
          cost.shipping_cost?.total_cost_incl_tax ??
            cost.shipping_cost?.total_cost_excl_tax ??
            0,
        ) * 100,
      ) / 100;

    const book = bookPrice(order.chapter_count);
    const videoMemoryPrice = centsToUsd(quote.totalCents);

    let estimatedBytes = 0;
    let estimatedStorageCost = 0;
    if (placedVideos.length > 0) {
      estimatedBytes = placedVideos.reduce(
        (sum, video) => sum + video.processedBytes,
        0,
      );
      try {
        const estimate = await estimatePermanentStorageCost(estimatedBytes);
        estimatedStorageCost = estimate.costUsd;
      } catch {
        return Response.json({ error: STORAGE_UNAVAILABLE_MESSAGE }, { status: 503 });
      }
      if (
        videoMemoryPrice > 0 &&
        estimatedStorageCost > videoMemoryPrice * VIDEO_MEMORY_MAX_STORAGE_COST_RATIO
      ) {
        console.error("[ourTailTales] storage cost safety guard", {
          orderId,
          estimatedStorageCost,
          videoMemoryPrice,
        });
        return Response.json({ error: STORAGE_UNAVAILABLE_MESSAGE }, { status: 503 });
      }
    }

    const amount = toMinorUnits(book + videoMemoryPrice + shippingPrice);

    const stripe = stripeClient();
    const paymentIntent = order.stripe_payment_intent_id
      ? await stripe.paymentIntents.update(order.stripe_payment_intent_id, {
          amount,
          receipt_email: email,
          metadata: analyticsMetadata,
        })
      : await stripe.paymentIntents.create({
          amount,
          currency: "usd",
          // Let Stripe decide which methods to show for this account.
          automatic_payment_methods: { enabled: true },
          receipt_email: email,
          description: `ourTailTales hardcover (${order.chapter_count} chapters)`,
          metadata: analyticsMetadata,
        });

    const { error: orderUpdateError } = await supabase
      .from("orders")
      .update({
        email: email.toLowerCase().trim(),
        shipping_price: shippingPrice,
        stripe_payment_intent_id: paymentIntent.id,
        selected_video_count: quote.includedUniqueVideoCount,
        video_memory_pack_count: quote.packCount,
        video_memory_pack_unit_price_cents: quote.unitPriceCents,
        video_memory_total_cents: quote.totalCents,
        estimated_permanent_bytes: estimatedBytes || null,
        estimated_permanent_storage_cost: estimatedStorageCost || null,
        estimated_video_memory_margin_cents:
          quote.totalCents - Math.round(estimatedStorageCost * 100),
        archival_consent_at:
          quote.includedUniqueVideoCount > 0
            ? new Date().toISOString()
            : null,
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

    await captureServerEvent(distinctId, "payment_intent_created", {
      total: book + videoMemoryPrice + shippingPrice,
      book_price: book,
      shipping_price: shippingPrice,
      video_memory_price: videoMemoryPrice,
      video_memory_count: quote.includedUniqueVideoCount,
      shipping_level: shippingLevel,
    });

    return Response.json({
      clientSecret: paymentIntent.client_secret,
      bookPrice: book,
      videoMemoryPrice,
      shippingPrice,
      total: book + videoMemoryPrice + shippingPrice,
    });
  } catch (error) {
    await captureServerException(
      error,
      postHogDistinctId(request, "server_payment_request"),
    );
    return routeError(error, "Payment could not be set up.");
  }
}

function addressNeedsConfirmation(
  cost: {
    warnings?: { message?: string }[];
    shipping_address?: {
      warnings?: { message?: string }[];
      suggested_address?: {
        street1?: string | null;
        city?: string | null;
        state_code?: string | null;
        postcode?: string | null;
      };
    };
  },
  entered: ShippingAddress,
): boolean {
  const warnings = [
    ...(cost.warnings ?? []),
    ...(cost.shipping_address?.warnings ?? []),
  ].filter((item) => item.message);

  if (warnings.length > 0) return true;

  const raw = cost.shipping_address?.suggested_address;
  if (!raw) return false;

  const postcodeDiffers =
    raw.postcode &&
    normalizePostcode(raw.postcode) !== normalizePostcode(entered.postcode);
  const streetDiffers = raw.street1 && raw.street1 !== entered.street1;
  const cityDiffers = raw.city && raw.city !== entered.city;
  const stateDiffers = raw.state_code && raw.state_code !== entered.state;

  return Boolean(postcodeDiffers || streetDiffers || cityDiffers || stateDiffers);
}

function normalizePostcode(value: string): string {
  return value.replace(/\s+/g, "").toUpperCase();
}
