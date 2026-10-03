import { includeDigitalCopy } from "@/lib/order/after-payment";
import { PREVIEW_BUCKET, supabaseAdmin, supabaseConfigured } from "@/lib/supabase/server";
import type { OrderStatus } from "@/types/order";

const LINK_TTL_SECONDS = 60 * 60;

/** Statuses in which the customer has paid and the money has not gone back. */
const PAID: ReadonlySet<OrderStatus> = new Set<OrderStatus>([
  "paid",
  "submitted",
  "production",
  "shipped",
  "delivered",
  "needs_review",
]);

/**
 * Statuses in which a PDF that was not unlocked at payment may be unlocked now.
 *
 * The paid ones, without `needs_review`: an order on hold may be there because
 * its payment is short, refunded or disputed, and a hold is not the moment to
 * hand anything over. A PDF already unlocked stays downloadable while held.
 */
const SETTLED: ReadonlySet<OrderStatus> = new Set<OrderStatus>([
  "paid",
  "submitted",
  "production",
  "shipped",
  "delivered",
]);

/** Whether the order page should say the PDF copy is still to come. */
export function pdfCopyExpected(status: OrderStatus): boolean {
  return SETTLED.has(status);
}

/**
 * A short-lived link to the clean PDF that comes with a hardcover.
 *
 * The file belongs to the draft the book was made from. Signed here on the
 * server so the order page can offer the download without the draft's own
 * secret, which the server never stores.
 *
 * The payment webhook unlocks the draft, but only if the book had been banked
 * by then. The bank runs in the customer's browser beside the checkout and can
 * easily finish after the payment lands, so a draft that has its clean file
 * and is not yet unlocked is unlocked here, the first time the order page is
 * opened after both are true. Same conditional update, recorded against the
 * same payment, so a refund takes it back the same way.
 *
 * Only ever called after the order's token has been checked.
 */
export async function includedPdfUrl(
  orderId: string,
  status: OrderStatus,
): Promise<string | null> {
  if (!supabaseConfigured() || !PAID.has(status)) return null;

  try {
    const supabase = supabaseAdmin();
    const { data: order } = await supabase
      .from("orders")
      .select("draft_id, chapter_count, stripe_payment_intent_id")
      .eq("id", orderId)
      .maybeSingle();
    if (!order?.draft_id) return null;

    const { data: draft } = await supabase
      .from("book_drafts")
      .select("digital_purchased_at, clean_pdf_storage_path")
      .eq("id", order.draft_id)
      .maybeSingle();
    if (!draft?.clean_pdf_storage_path) return null;

    if (!draft.digital_purchased_at) {
      if (!SETTLED.has(status)) return null;
      const unlocked = await includeDigitalCopy({
        draftId: order.draft_id,
        paymentIntentId: order.stripe_payment_intent_id,
        chapterCount: order.chapter_count,
      });
      if (!unlocked) return null;
    }

    const { data: signed } = await supabase.storage
      .from(PREVIEW_BUCKET)
      .createSignedUrl(draft.clean_pdf_storage_path, LINK_TTL_SECONDS, {
        download: "ourTailTales-book.pdf",
      });
    return signed?.signedUrl ?? null;
  } catch {
    return null;
  }
}
