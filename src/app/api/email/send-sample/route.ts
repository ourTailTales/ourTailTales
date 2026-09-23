import { z } from "zod";

import { draftSecretFromRequest } from "@/lib/drafts/token";
import { resolveDraft } from "@/lib/drafts/resolve";
import { bookUrl } from "@/lib/drafts/storage";
import { routeError } from "@/lib/env";
import { sendFreePdfEmail } from "@/lib/email/send";
import { supabaseAdmin } from "@/lib/supabase/server";

/**
 * Emails the customer a link to their free book.
 *
 * Authenticated with the draft credentials rather than a bare draft id: the
 * link it sends carries the draft secret, so whoever asks for that mail has to
 * already hold the secret. Otherwise anyone who learned a draft id could have
 * a working link posted to an address of their choosing.
 *
 * The PDF is never attached. A full book at preview resolution is past what
 * mailboxes will take, and a link keeps showing the current copy after a
 * purchase removes the watermark.
 */

const requestSchema = z.object({
  email: z.email().max(200),
  petName: z.string().max(80).optional().default(""),
});

export async function POST(request: Request): Promise<Response> {
  try {
    const draft = await resolveDraft(request);
    const secret = draftSecretFromRequest(request);
    if (!draft || !secret) {
      return Response.json({ error: "Unknown draft." }, { status: 401 });
    }

    const parsed = requestSchema.safeParse(await request.json());
    if (!parsed.success) {
      return Response.json(
        { error: "That email address doesn't look right." },
        { status: 400 },
      );
    }

    // Only send once there is something to open. Mailing a link to a book that
    // has not finished uploading is worse than not mailing at all.
    const { data: row } = await supabaseAdmin()
      .from("book_drafts")
      .select("pdf_storage_path, pet_name")
      .eq("id", draft.id)
      .maybeSingle();

    if (!row?.pdf_storage_path) {
      return Response.json(
        { error: "Your book is still being prepared. Please try again shortly." },
        { status: 409 },
      );
    }

    const result = await sendFreePdfEmail({
      to: parsed.data.email,
      petName: parsed.data.petName || (row.pet_name ?? ""),
      bookUrl: bookUrl(draft.id, secret),
    });

    // A missing API key is a deployment gap, not a customer error: the book
    // itself is fine and already downloadable.
    return Response.json({ sent: result.sent, reason: result.reason });
  } catch (error) {
    return routeError(error, "That email could not be sent.");
  }
}
