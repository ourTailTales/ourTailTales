import { draftSecretFromRequest } from "@/lib/drafts/token";
import { resolveDraft } from "@/lib/drafts/resolve";
import { bookUrl } from "@/lib/drafts/storage";
import { routeError } from "@/lib/env";
import { digitalTaxCode, salesTaxEnabled } from "@/lib/order/tax";
import { alertOps } from "@/lib/ops/alert";
import { BASE_CHAPTERS, digitalPriceFor } from "@/lib/pricing";
import { LIMITS, enforceRateLimit } from "@/lib/rate-limit";
import { stripeClient, toMinorUnits } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabase/server";

/**
 * Checkout for the clean PDF — 30% of the hardcover price for this book's
 * chapter count.
 *
 * The amount comes from `pricing.ts` and the draft's own stored chapter
 * count, never from the request: the browser says which book, not what it
 * costs. Nothing is granted here either — the webhook is still the only
 * thing that records a payment.
 */
export async function POST(request: Request): Promise<Response> {
  try {
    const draft = await resolveDraft(request);
    const secret = draftSecretFromRequest(request);
    if (!draft || !secret) {
      return Response.json({ error: "Unknown book." }, { status: 401 });
    }

    // Counted against the draft rather than the caller's address: the secret
    // is what already gates this route, and a shared link necessarily hands
    // that secret to whoever opens it.
    const limited = await enforceRateLimit(
      request,
      LIMITS.checkoutDigital,
      `draft:${draft.id}`,
    );
    if (limited) return limited;

    const { data: row } = await supabaseAdmin()
      .from("book_drafts")
      .select(
        "pet_name, pdf_storage_path, clean_pdf_storage_path, digital_purchased_at, expires_at, chapter_count",
      )
      .eq("id", draft.id)
      .maybeSingle();

    if (!row?.pdf_storage_path) {
      return Response.json(
        { error: "This book is still being prepared." },
        { status: 409 },
      );
    }
    // Until the whole book has been banked, the only file here is the free
    // ten-page teaser — and selling someone a "complete book" that turns out
    // to be the sample they already had would be the worst thing this product
    // could do. Banking happens when the account is made, so that is the ask.
    if (!row.clean_pdf_storage_path) {
      return Response.json(
        {
          error:
            "Make your free account first. That is what opens the whole book, and then you can buy the clean PDF.",
        },
        { status: 409 },
      );
    }
    // Past its date and simply not reaped yet. Selling it here means taking
    // money for a file the nightly sweep is about to delete, and the buyer
    // gets a signed URL to nothing.
    if (
      !row.digital_purchased_at &&
      row.expires_at &&
      new Date(row.expires_at).getTime() <= Date.now()
    ) {
      return Response.json(
        {
          error:
            "This book has expired. Make a new one and we will keep it for you.",
        },
        { status: 410 },
      );
    }
    if (row.digital_purchased_at) {
      // Already paid for. Send them back to the book rather than charging
      // twice for the same file.
      return Response.json({ url: bookUrl(draft.id, secret) });
    }

    const petName = (row.pet_name ?? "").trim();
    const posthogDistinctId = request.headers.get("x-posthog-distinct-id");
    const returnUrl = bookUrl(draft.id, secret);
    const price = digitalPriceFor(row.chapter_count ?? BASE_CHAPTERS);

    // With sales tax on, Stripe's own checkout page asks for the buyer's
    // address, adds the tax for it and records it. It adds nothing in a state
    // the account is not registered in.
    const taxCode = digitalTaxCode();
    const createSession = (withTax: boolean) =>
      stripeClient().checkout.sessions.create({
        mode: "payment",
        // Cards only, as for the hardcover. A method that settles days later
        // completes the session unpaid, and the PDF was then never released.
        payment_method_types: ["card"],
        ...(withTax ? { automatic_tax: { enabled: true } } : {}),
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: "usd",
              unit_amount: toMinorUnits(price),
              ...(withTax ? { tax_behavior: "exclusive" as const } : {}),
              product_data: {
                name: petName ? `${petName}’s book (full PDF)` : "Your book (full PDF)",
                description:
                  "The complete book as a PDF, without the watermark, kept permanently.",
                ...(withTax ? { tax_code: taxCode } : {}),
              },
            },
          },
        ],
        // Carried through to the webhook, which is where access is actually
        // granted. The secret rides along so the confirmation email can link
        // straight back to the book.
        // posthogDistinctId ties the purchase back to the browser that made
        // the book, so it lands in the same person's conversion funnel.
        metadata: {
          draftId: draft.id,
          draftSecret: secret,
          // The length this price is for. The webhook releases the file only
          // if the book on the draft is still no longer than this.
          chapterCount: String(row.chapter_count ?? BASE_CHAPTERS),
          ...(posthogDistinctId ? { posthogDistinctId } : {}),
        },
        success_url: `${returnUrl}&purchased=true`,
        cancel_url: returnUrl,
      });

    let session: Awaited<ReturnType<typeof createSession>>;
    if (salesTaxEnabled()) {
      try {
        session = await createSession(true);
      } catch (taxError) {
        // Stripe Tax not set up on the account is the usual cause. The sale
        // goes ahead without tax and a person is told.
        await alertOps("Sales tax could not be added to a PDF checkout", {
          draft: draft.id,
          error: taxError instanceof Error ? taxError.message : String(taxError),
          note: "The checkout was opened with no sales tax. Check that Stripe Tax is set up on the account, or set STRIPE_TAX_ENABLED=false.",
        });
        session = await createSession(false);
      }
    } else {
      session = await createSession(false);
    }

    if (!session.url) {
      throw new Error("Stripe did not return a checkout URL.");
    }

    return Response.json({ url: session.url });
  } catch (error) {
    return routeError(error, "Checkout could not be started.");
  }
}
