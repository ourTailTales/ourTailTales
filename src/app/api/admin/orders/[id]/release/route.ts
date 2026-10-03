import { authorizeCron } from "@/lib/cron/auth";
import { routeError } from "@/lib/env";
import { supabaseAdmin } from "@/lib/supabase/server";

/**
 * Lifts a hold from an order that is already at the printer.
 *
 * An order held for review is left alone by everything automatic: the nightly
 * reconcile only reads open orders, and the printer's webhook will not move an
 * order that is on hold. That is right while somebody is looking at it, and it
 * meant that once they had finished there was no way to say so. The book went
 * on being printed and shipped while its page said it was being looked into.
 *
 * This puts the order back to `submitted`, which is the status both of those
 * pick up from. The next reconcile or printer event then moves it to wherever
 * the job really is, and sends the shipped email if that is where it is.
 *
 *   curl -X POST https://www.ourtailtales.com/api/admin/orders/<id>/release \
 *     -H "Authorization: Bearer $CRON_SECRET"
 *
 * Only an order that is held AND has a print job. One with no print job has
 * nothing to pick up; that is what the sibling `resubmit` route is for. This
 * sends nothing to the printer and checks nothing at Stripe: it is for a
 * person who has already decided the hold is over.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const unauthorized = authorizeCron(request);
  if (unauthorized) return unauthorized;

  try {
    const { id } = await params;
    if (!/^[0-9a-f-]{36}$/i.test(id)) {
      return Response.json({ error: "Unknown order." }, { status: 404 });
    }

    const supabase = supabaseAdmin();
    const { data: order, error } = await supabase
      .from("orders")
      .select("id, status, lulu_print_job_id")
      .eq("id", id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!order) return Response.json({ error: "Unknown order." }, { status: 404 });

    if (order.status !== "needs_review") {
      return Response.json(
        { error: `This order is ${order.status}, not held for review.` },
        { status: 409 },
      );
    }
    if (!order.lulu_print_job_id) {
      return Response.json(
        {
          error:
            "This order has no print job to pick up. To send it to print, POST /api/admin/orders/<id>/resubmit.",
        },
        { status: 409 },
      );
    }

    // Conditional on what was just read, so this cannot undo a change made in
    // the moment between.
    const { data: released, error: releaseError } = await supabase
      .from("orders")
      .update({ status: "submitted", review_reason: null })
      .eq("id", id)
      .eq("status", "needs_review")
      .eq("lulu_print_job_id", order.lulu_print_job_id)
      .select("id");
    if (releaseError) throw new Error(releaseError.message);
    if (!released || released.length === 0) {
      return Response.json(
        { error: "This order changed while it was being released. Look at it again." },
        { status: 409 },
      );
    }

    return Response.json({
      ok: true,
      status: "submitted",
      printJob: order.lulu_print_job_id,
    });
  } catch (error) {
    return routeError(error, "The order could not be released.");
  }
}
