import { z } from "zod";

import { resolveDraft } from "@/lib/drafts/resolve";
import { routeError } from "@/lib/env";
import { draftPdfPath } from "@/lib/drafts/storage";
import { watermarkPdf } from "@/lib/book/watermark";
import { BASE_CHAPTERS, MAX_CHAPTERS } from "@/lib/pricing";
import { PREVIEW_BUCKET, supabaseAdmin } from "@/lib/supabase/server";

/**
 * Banks the free preview PDF so it can be opened from a link rather than only
 * from the browser that rendered it.
 *
 * Two steps, because the file is too big to post through a route handler:
 * a full book at preview resolution routinely clears Vercel's 4.5 MB request
 * body cap, and base64 would add a third again on top. So the browser uploads
 * straight to private storage through a scoped, expiring URL — the same shape
 * `api/order-assets` already uses for print files.
 *
 *   POST — mint a signed upload URL for the clean PDF.
 *   PUT  — the bytes have landed: watermark them, bank both copies, start the
 *          30-day clock.
 *
 * The watermark is applied here rather than trusted from the client. The
 * renderer can already stamp one, but a flag the browser controls is a flag
 * the browser can drop.
 */

/**
 * Watermarking downloads the whole book, stamps every page with pdf-lib and
 * re-uploads it. That comfortably outruns the default function budget on a long
 * book, and a timeout here leaves `pdf_storage_path` unset — which the book page
 * reads as "not a book" and redirects. 60s is the Hobby ceiling.
 */
export const maxDuration = 60;

const DAYS_UNTIL_EXPIRY = 30;

const finalizeSchema = z.object({
  petName: z.string().max(80).optional().default(""),
  chapterCount: z.number().int().min(BASE_CHAPTERS).max(MAX_CHAPTERS).optional(),
});

/** Step one: where should the browser put the clean PDF? */
export async function POST(request: Request): Promise<Response> {
  try {
    const draft = await resolveDraft(request);
    if (!draft) {
      return Response.json({ error: "Unknown draft." }, { status: 401 });
    }

    const path = draftPdfPath(draft.id, "clean");
    const { data, error } = await supabaseAdmin()
      .storage.from(PREVIEW_BUCKET)
      .createSignedUploadUrl(path, { upsert: true });

    if (error || !data) {
      throw new Error(error?.message ?? "Could not sign the preview upload.");
    }

    return Response.json({ path, signedUrl: data.signedUrl });
  } catch (error) {
    return routeError(error, "Your book could not be prepared for sharing.");
  }
}

/** Step two: the clean PDF is in storage — watermark it and record the draft. */
export async function PUT(request: Request): Promise<Response> {
  try {
    const draft = await resolveDraft(request);
    if (!draft) {
      return Response.json({ error: "Unknown draft." }, { status: 401 });
    }

    const parsed = finalizeSchema.safeParse(await request.json());
    if (!parsed.success) {
      return Response.json(
        { error: "Please check your book details and try again." },
        { status: 400 },
      );
    }

    const supabase = supabaseAdmin();
    const cleanPath = draftPdfPath(draft.id, "clean");
    const previewPath = draftPdfPath(draft.id, "preview");

    const { data: cleanFile, error: downloadError } = await supabase.storage
      .from(PREVIEW_BUCKET)
      .download(cleanPath);

    if (downloadError || !cleanFile) {
      return Response.json(
        { error: "Your book has not finished uploading yet." },
        { status: 409 },
      );
    }

    const watermarked = await watermarkPdf(
      new Uint8Array(await cleanFile.arrayBuffer()),
    );

    const { error: uploadError } = await supabase.storage
      .from(PREVIEW_BUCKET)
      .upload(previewPath, watermarked, {
        upsert: true,
        contentType: "application/pdf",
        cacheControl: "3600",
      });
    if (uploadError) throw new Error(uploadError.message);

    const now = new Date();
    const expiresAt = new Date(now);
    expiresAt.setUTCDate(expiresAt.getUTCDate() + DAYS_UNTIL_EXPIRY);

    // A draft that has already been paid for keeps whatever it has: re-running
    // this must never re-watermark a bought book or revive its expiry.
    const { data: existing } = await supabase
      .from("book_drafts")
      .select("digital_purchased_at")
      .eq("id", draft.id)
      .maybeSingle();
    const purchased = Boolean(existing?.digital_purchased_at);

    const { error: updateError } = await supabase
      .from("book_drafts")
      .update({
        pdf_storage_path: previewPath,
        clean_pdf_storage_path: cleanPath,
        pdf_stored_at: now.toISOString(),
        expires_at: purchased ? null : expiresAt.toISOString(),
        watermarked: !purchased,
        pet_name: parsed.data.petName.trim(),
        chapter_count: parsed.data.chapterCount ?? null,
        updated_at: now.toISOString(),
      })
      .eq("id", draft.id);
    if (updateError) throw new Error(updateError.message);

    return Response.json({
      draftId: draft.id,
      expiresAt: purchased ? null : expiresAt.toISOString(),
    });
  } catch (error) {
    return routeError(error, "Your book could not be prepared for sharing.");
  }
}
