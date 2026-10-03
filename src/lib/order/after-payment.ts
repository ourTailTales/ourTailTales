import { sendOrderConfirmationEmail } from "@/lib/email/send";
import { copiesTotal } from "@/lib/pricing";
import { isMissingColumnError } from "@/lib/supabase/missing-column";
import { supabaseAdmin } from "@/lib/supabase/server";

/**
 * What a paid hardcover is owed besides the print job: the confirmation email
 * and the clean PDF that comes with the book.
 *
 * Shared by the payment webhook and the operator's resubmit route, so an order
 * that was held before either happened gets both when it is released. Neither
 * ever throws: nothing here may stop, or undo, a book going to print.
 */

/** The column a draft's unlock is recorded against, so a refund can find it. */
export const DRAFT_PAYMENT_INTENT_COLUMN = "digital_stripe_payment_intent_id";

/** Best-effort order confirmation. Never throws. */
export async function confirmByEmail(orderId: string): Promise<void> {
  try {
    const { data: order, error } = await supabaseAdmin()
      .from("orders")
      .select(
        "id, email, pet_name, book_price, quantity, shipping_price, video_memory_total_cents",
      )
      .eq("id", orderId)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!order?.email) return;

    const total =
      copiesTotal(Number(order.book_price ?? 0), Number(order.quantity ?? 1)) +
      Number(order.video_memory_total_cents ?? 0) / 100 +
      Number(order.shipping_price ?? 0);

    await sendOrderConfirmationEmail({
      to: order.email,
      petName: order.pet_name ?? "",
      orderId: order.id,
      copies: Number(order.quantity ?? 1),
      total: new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
      }).format(total),
    });
  } catch (error) {
    console.error("[ourTailTales] Order confirmation email failed", orderId, error);
  }
}

/**
 * Unlocks the clean PDF for the draft a hardcover was made from.
 *
 * Only where the full book has actually been banked: marking a draft as bought
 * with no clean file behind it would turn a working preview link into a broken
 * one. Recorded against the order's payment, so a refund that cancels the
 * order takes the file back the same way a refunded PDF purchase does.
 *
 * Only where the banked book is no longer than the one that was paid for. The
 * draft is the customer's to write to, so without this a five-chapter
 * hardcover could unlock a fifty-chapter PDF banked onto the same draft.
 *
 * Conditional on not already being unlocked, so it is safe to call again: the
 * webhook calls it at payment, and the order page calls it later for a book
 * that finished banking after the payment landed. Returns whether this call
 * unlocked it. Best-effort: never throws.
 */
export async function includeDigitalCopy(args: {
  draftId: string | null;
  paymentIntentId: string | null;
  /** The chapters the hardcover was priced at. */
  chapterCount: number | null;
}): Promise<boolean> {
  const { draftId, paymentIntentId, chapterCount } = args;
  if (!draftId || !paymentIntentId) return false;
  const chapters = Math.floor(Number(chapterCount));
  if (!Number.isFinite(chapters) || chapters < 1) return false;

  try {
    const now = new Date().toISOString();
    const { data, error } = await supabaseAdmin()
      .from("book_drafts")
      .update({
        digital_purchased_at: now,
        [DRAFT_PAYMENT_INTENT_COLUMN]: paymentIntentId,
        watermarked: false,
        expires_at: null,
        updated_at: now,
      })
      .eq("id", draftId)
      .is("digital_purchased_at", null)
      .not("clean_pdf_storage_path", "is", null)
      .or(`chapter_count.is.null,chapter_count.lte.${chapters}`)
      .select("id");

    if (isMissingColumnError(error, DRAFT_PAYMENT_INTENT_COLUMN)) {
      // Deliberately not unlocked without the link to its payment: a refund
      // would have nothing to find the draft by and could never take it back.
      console.error(
        `[ourTailTales] book_drafts.${DRAFT_PAYMENT_INTENT_COLUMN} is missing; the included PDF was not unlocked`,
        draftId,
      );
      return false;
    }
    if (error) throw new Error(error.message);
    return Boolean(data && data.length > 0);
  } catch (error) {
    console.error("[ourTailTales] Could not include the digital copy", draftId, error);
    return false;
  }
}

/**
 * Runs a follow-up step so that neither a failure nor a stall can reach the
 * caller.
 *
 * The steps after a print job is submitted are mail and analytics. Each talks
 * to somebody else's server, and a function has a fixed number of seconds to
 * live. Resolves when the step does or when its time is up, whichever is
 * first, and never rejects.
 */
export async function quietly(
  label: string,
  step: () => Promise<unknown>,
  timeoutMs = 8_000,
): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      Promise.resolve().then(step),
      new Promise<void>((resolve) => {
        timer = setTimeout(() => {
          console.error(`[ourTailTales] ${label} did not finish in ${timeoutMs}ms`);
          resolve();
        }, timeoutMs);
      }),
    ]);
  } catch (error) {
    console.error(`[ourTailTales] ${label} failed`, error);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
