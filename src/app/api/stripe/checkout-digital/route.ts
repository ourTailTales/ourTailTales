import { draftSecretFromRequest } from "@/lib/drafts/token";
import { resolveDraft } from "@/lib/drafts/resolve";
import { bookUrl } from "@/lib/drafts/storage";
import { routeError } from "@/lib/env";
import { DIGITAL_PRICE } from "@/lib/pricing";
import { stripeClient, toMinorUnits } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabase/server";

/**
 * Checkout for the $4.99 clean PDF.
 *
 * The amount comes from `pricing.ts`, never from the request: the browser says
 * which book, not what it costs. Nothing is granted here either — the webhook
 * is still the only thing that records a payment.
 */
export async function POST(request: Request): Promise<Response> {
  try {
    const draft = await resolveDraft(request);
    const secret = draftSecretFromRequest(request);
    if (!draft || !secret) {
      return Response.json({ error: "Unknown book." }, { status: 401 });
    }

    const { data: row } = await supabaseAdmin()
      .from("book_drafts")
      .select("pet_name, pdf_storage_path, digital_purchased_at")
      .eq("id", draft.id)
      .maybeSingle();

    if (!row?.pdf_storage_path) {
      return Response.json(
        { error: "This book is still being prepared." },
        { status: 409 },
      );
    }
    if (row.digital_purchased_at) {
      // Already paid for. Send them back to the book rather than charging
      // twice for the same file.
      return Response.json({ url: bookUrl(draft.id, secret) });
    }

    const petName = (row.pet_name ?? "").trim();
    const returnUrl = bookUrl(draft.id, secret);

    const session = await stripeClient().checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: toMinorUnits(DIGITAL_PRICE),
            product_data: {
              name: petName ? `${petName}’s book — full PDF` : "Your book — full PDF",
              description:
                "The complete book as a PDF, without the watermark, kept permanently.",
            },
          },
        },
      ],
      // Carried through to the webhook, which is where access is actually
      // granted. The secret rides along so the confirmation email can link
      // straight back to the book.
      metadata: { draftId: draft.id, draftSecret: secret },
      success_url: `${returnUrl}&purchased=true`,
      cancel_url: returnUrl,
    });

    if (!session.url) {
      throw new Error("Stripe did not return a checkout URL.");
    }

    return Response.json({ url: session.url });
  } catch (error) {
    return routeError(error, "Checkout could not be started.");
  }
}
