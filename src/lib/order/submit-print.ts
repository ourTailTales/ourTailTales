import { createPrintJob } from "@/lib/lulu/client";
import { fulfilmentModeMismatch } from "@/lib/stripe";
import { STORAGE_BUCKET, supabaseAdmin } from "@/lib/supabase/server";
import type { ShippingAddress } from "@/types/order";

const DOWNLOAD_TTL_SECONDS = 60 * 60 * 24 * 7;

export async function signDownload(path: string): Promise<string> {
  const { data, error } = await supabaseAdmin()
    .storage.from(STORAGE_BUCKET)
    .createSignedUrl(path, DOWNLOAD_TTL_SECONDS);

  if (error || !data?.signedUrl) {
    throw new Error(error?.message ?? `Could not sign download for ${path}`);
  }
  return data.signedUrl;
}

export async function markNeedsReview(orderId: string, reason: string): Promise<void> {
  await supabaseAdmin()
    .from("orders")
    .update({ status: "needs_review", review_reason: reason })
    .eq("id", orderId);
}

export async function submitPaidOrderToLulu(orderId: string): Promise<void> {
  const supabase = supabaseAdmin();
  const { data: order, error } = await supabase
    .from("orders")
    .select(
      "id, email, pet_name, total_pages, interior_path, cover_path, lulu_print_job_id",
    )
    .eq("id", orderId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!order || order.lulu_print_job_id) return;
  if (!order.interior_path || !order.cover_path) {
    await markNeedsReview(orderId, "Print files were missing at submission time.");
    return;
  }
  if (!order.email) {
    await markNeedsReview(orderId, "No customer email was recorded.");
    return;
  }
  // Checked before anything is signed or sent. A live charge whose print job
  // goes to the sandbox is indistinguishable from success on both dashboards,
  // so the order stops here and waits for a human rather than disappearing.
  if (fulfilmentModeMismatch()) {
    await markNeedsReview(
      orderId,
      "Stripe is in live mode but LULU_ENV is not production — refused to send a paid order to the Lulu sandbox.",
    );
    return;
  }

  const { data: shipping, error: shippingError } = await supabase
    .from("order_shipping")
    .select("*")
    .eq("order_id", orderId)
    .maybeSingle();

  if (shippingError) throw new Error(shippingError.message);
  if (!shipping) {
    await markNeedsReview(orderId, "No shipping address was recorded.");
    return;
  }

  const [interiorUrl, coverUrl] = await Promise.all([
    signDownload(order.interior_path),
    signDownload(order.cover_path),
  ]);

  const printJob = await createPrintJob({
    orderId,
    title: order.pet_name ? `${order.pet_name} — ourTailTales` : "ourTailTales",
    pageCount: order.total_pages,
    interiorUrl,
    coverUrl,
    email: order.email,
    address: {
      name: shipping.name,
      phone: shipping.phone,
      street1: shipping.street1,
      street2: shipping.street2 ?? undefined,
      city: shipping.city,
      state: shipping.state,
      postcode: shipping.postcode,
      country: "US",
    } satisfies ShippingAddress,
    shippingLevel: shipping.shipping_level,
  });

  const { error: saveError } = await supabase
    .from("orders")
    .update({
      lulu_print_job_id: String(printJob.id),
      lulu_status: printJob.status?.name ?? null,
      tracking_urls: printJob.tracking_urls ?? null,
      status: "submitted",
      fulfillment_stage: "submitted",
      submitted_at: new Date().toISOString(),
    })
    .eq("id", orderId)
    .is("lulu_print_job_id", null);

  if (saveError) throw new Error(saveError.message);
}
