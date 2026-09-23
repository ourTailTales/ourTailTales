import { z } from "zod";

import { draftSecretFromRequest } from "@/lib/drafts/token";
import { resolveDraft } from "@/lib/drafts/resolve";
import { claimUrl, draftPdfPath } from "@/lib/drafts/storage";
import { routeError } from "@/lib/env";
import { sendTeaserEmail } from "@/lib/email/send";
import { PREVIEW_BUCKET, supabaseAdmin } from "@/lib/supabase/server";

/**
 * Emails the customer their first ten pages, with the PDF attached, plus the
 * link that opens the rest.
 *
 * Authenticated with the draft credentials rather than a bare draft id: the
 * link it sends carries the draft secret, so whoever asks for this mail has to
 * already hold that secret. Otherwise anyone who learned a draft id could have
 * a working link posted to an address of their choosing.
 *
 * The bytes are read from storage rather than accepted from the request. The
 * teaser is banked the moment the book is written, and a route handler's body
 * cap is below what a ten-page photo book weighs anyway.
 */

const requestSchema = z.object({
  email: z.email().max(200),
  petName: z.string().max(80).optional().default(""),
  hiddenChapters: z.number().int().min(0).max(200).optional().default(0),
  hiddenPages: z.number().int().min(0).max(2000).optional().default(0),
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

    const supabase = supabaseAdmin();
    const { data: row } = await supabase
      .from("book_drafts")
      .select("pdf_stored_at, pet_name")
      .eq("id", draft.id)
      .maybeSingle();

    // Only send once there is something to attach. Mailing an empty welcome
    // is worse than not mailing at all.
    if (!row?.pdf_stored_at) {
      return Response.json(
        { error: "Your book is still being prepared. Please try again shortly." },
        { status: 409 },
      );
    }

    const { data: file, error: downloadError } = await supabase.storage
      .from(PREVIEW_BUCKET)
      .download(draftPdfPath(draft.id, "teaser"));

    if (downloadError || !file) {
      return Response.json(
        { error: "Your book is still being prepared. Please try again shortly." },
        { status: 409 },
      );
    }

    const petName = parsed.data.petName || (row.pet_name ?? "");
    const result = await sendTeaserEmail({
      to: parsed.data.email,
      petName,
      claimUrl: claimUrl(draft.id, secret),
      hiddenChapters: parsed.data.hiddenChapters,
      hiddenPages: parsed.data.hiddenPages,
      pdf: new Uint8Array(await file.arrayBuffer()),
      fileName: `ourtailtales-${slug(petName)}-first-pages.pdf`,
    });

    // Remembered so the claim link can prefill it rather than asking for an
    // address they have already given. Best effort — failing to record it
    // costs one prefilled field, never the email itself.
    if (result.sent) {
      await supabase
        .from("book_drafts")
        .update({ lead_email: parsed.data.email })
        .eq("id", draft.id)
        .then(
          () => undefined,
          () => undefined,
        );
    }

    // A missing API key is a deployment gap, not a customer error: the book
    // itself is fine and already on their screen.
    return Response.json({ sent: result.sent, reason: result.reason });
  } catch (error) {
    return routeError(error, "That email could not be sent.");
  }
}

function slug(petName: string): string {
  return (
    petName
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "pet"
  );
}
