import { z } from "zod";

import { previewExpiryFrom } from "@/lib/drafts/expiry";
import { resolveDraft } from "@/lib/drafts/resolve";
import { routeError } from "@/lib/env";
import { draftPdfPath, type DraftPdfKind } from "@/lib/drafts/storage";
import { pdfPageCount } from "@/lib/book/pdf-pages";
import { TEASER_PAGE_COUNT, TEASER_PDF_MAX_PAGES } from "@/lib/book/teaser";
import { watermarkPdf } from "@/lib/book/watermark";
import { BASE_CHAPTERS, MAX_CHAPTERS } from "@/lib/pricing";
import { LIMITS, enforceRateLimit } from "@/lib/rate-limit";
import { PREVIEW_BUCKET, supabaseAdmin } from "@/lib/supabase/server";

/**
 * Banks the free preview PDF so it can be opened from a link rather than only
 * from the browser that rendered it.
 *
 * Two steps, because the file is too big to post through a route handler:
 * a full book at preview resolution routinely clears Vercel's 4.5 MB request
 * body cap, and base64 would add a third again on top. So the browser uploads
 * straight to private storage through a scoped, expiring URL.
 *
 *   POST — mint a signed upload URL onto the staging path.
 *   PUT  — the bytes have landed: check them, write the files we will serve,
 *          start the 30-day clock.
 *
 * ## Why the browser never uploads to a path we serve
 *
 * Every upload lands on one staging path, `incoming.pdf`, and nothing is ever
 * served from there. The files that are served — `teaser.pdf`, `preview.pdf`,
 * `clean.pdf` — are written by this route from those bytes, after it has
 * looked at them.
 *
 * That indirection is the whole security boundary, and it is worth stating
 * why a simpler shape does not work. The client declares which book it is
 * banking, and one of the two answers, `teaser`, deliberately skips
 * watermarking. If the client uploaded straight to `teaser.pdf`, then checking
 * the page count on arrival would not be enough: the signed URL stays valid
 * afterwards, so the client could bank a real ten-page teaser, pass the check,
 * and then quietly overwrite those same bytes with the whole book. The path
 * has already been recorded as readable and unwatermarked, and every later
 * reader gets the full book for nothing.
 *
 * So the rule is: a client may overwrite the staging file as often as it
 * likes, and it will never be the file anybody reads.
 */

/**
 * Watermarking downloads the whole book, stamps every page with pdf-lib and
 * re-uploads it. That comfortably outruns the default function budget on a long
 * book, and a timeout here leaves `pdf_storage_path` unset — which the book page
 * reads as "not a book" and redirects. 60s is the Hobby ceiling.
 */
export const maxDuration = 60;

/**
 * Which book is being banked.
 *
 * `teaser` is the free ten pages, banked as soon as the book is written so the
 * welcome email has something to attach. It is the one that is not
 * watermarked, because it is the thing that has to make someone want the book,
 * which is exactly why its length is checked rather than taken on trust.
 *
 * `full` is the whole book, banked once the customer has an account. It lands
 * clean and is watermarked here, server-side: the renderer can stamp one too,
 * but a flag the browser controls is a flag the browser can drop.
 */
const bankKindSchema = z.enum(["teaser", "full"]).optional().default("full");

const finalizeSchema = z.object({
  petName: z.string().max(80).optional().default(""),
  chapterCount: z.number().int().min(BASE_CHAPTERS).max(MAX_CHAPTERS).optional(),
  kind: bankKindSchema,
});

/** Step one: where should the browser put the bytes? */
export async function POST(request: Request): Promise<Response> {
  try {
    const draft = await resolveDraft(request);
    if (!draft) {
      return Response.json({ error: "Unknown draft." }, { status: 401 });
    }

    // `kind` is still accepted in the body and deliberately ignored: which
    // book this is only matters once we can see the bytes, and until then
    // every upload goes to the same place.
    const path = draftPdfPath(draft.id, "incoming");
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

/** Step two: the bytes are in staging — check them and write what we serve. */
export async function PUT(request: Request): Promise<Response> {
  try {
    const draft = await resolveDraft(request);
    if (!draft) {
      return Response.json({ error: "Unknown draft." }, { status: 401 });
    }

    // Downloading a whole book, stamping every page and uploading it twice is
    // the most expensive thing this server does, and a draft costs nothing to
    // mint. Counted against the draft rather than the address, since holding
    // one is what gets you in here.
    const limited = await enforceRateLimit(request, LIMITS.bank, `draft:${draft.id}`);
    if (limited) return limited;

    const parsed = finalizeSchema.safeParse(await request.json());
    if (!parsed.success) {
      return Response.json(
        { error: "Please check your book details and try again." },
        { status: 400 },
      );
    }

    const supabase = supabaseAdmin();
    const teaser = parsed.data.kind === "teaser";
    const stagingPath = draftPdfPath(draft.id, "incoming");

    const { data: uploaded, error: downloadError } = await supabase.storage
      .from(PREVIEW_BUCKET)
      .download(stagingPath);

    if (downloadError || !uploaded) {
      return Response.json(
        { error: "Your book has not finished uploading yet." },
        { status: 409 },
      );
    }

    const bytes = new Uint8Array(await uploaded.arrayBuffer());
    const pages = await pdfPageCount(bytes);
    if (pages === null || pages === 0) {
      return Response.json(
        { error: "Your book has not finished uploading yet." },
        { status: 409 },
      );
    }

    const write = async (kind: DraftPdfKind, body: Uint8Array) => {
      const { error } = await supabase.storage
        .from(PREVIEW_BUCKET)
        .upload(draftPdfPath(draft.id, kind), body, {
          upsert: true,
          contentType: "application/pdf",
          cacheControl: "3600",
        });
      if (error) throw new Error(error.message);
    };

    let readablePath: DraftPdfKind;
    if (teaser) {
      // The only claim the client makes that has money behind it. A "teaser"
      // longer than the teaser is the whole book asking to skip the watermark.
      // The cap is one page more than the free content itself: the renderer
      // appends a "there is more" notice page whenever the book continues
      // past the teaser, which is true for nearly every real book.
      if (pages > TEASER_PDF_MAX_PAGES) {
        console.error(
          `[ourTailTales] Draft ${draft.id} banked a ${pages}-page file as a teaser.`,
        );
        return Response.json(
          { error: "That is not the free sample. Please try again." },
          { status: 400 },
        );
      }
      await write("teaser", bytes);
      readablePath = "teaser";
    } else if (pages <= TEASER_PAGE_COUNT) {
      // The other half of the same check. `clean_pdf_storage_path` being set
      // is the only thing `checkout-digital` looks at before selling "the
      // complete book", so a teaser banked as the full book would put a
      // ten-page file behind a $4.99 purchase. Two tabs on one lead email
      // share a draft and a staging path, so this is reachable by accident as
      // well as on purpose.
      console.error(
        `[ourTailTales] Draft ${draft.id} banked a ${pages}-page file as the whole book.`,
      );
      return Response.json(
        { error: "That is not the whole book. Please try again." },
        { status: 400 },
      );
    } else {
      await write("preview", await watermarkPdf(bytes));
      // The buyer's copy is written here too, so the file a purchase unlocks
      // is one the server put there rather than one the browser left behind.
      await write("clean", bytes);
      readablePath = "preview";
    }

    const now = new Date();
    const expiresAt = previewExpiryFrom(now);

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
        pdf_storage_path: draftPdfPath(draft.id, readablePath),
        // Only set once the whole book is here. Pointing a buyer's download at
        // a ten-page teaser would be the worst bug in the product.
        ...(teaser
          ? {}
          : { clean_pdf_storage_path: draftPdfPath(draft.id, "clean") }),
        pdf_stored_at: now.toISOString(),
        expires_at: purchased ? null : expiresAt.toISOString(),
        watermarked: !purchased && !teaser,
        pet_name: parsed.data.petName.trim(),
        chapter_count: parsed.data.chapterCount ?? null,
        updated_at: now.toISOString(),
      })
      .eq("id", draft.id);
    if (updateError) throw new Error(updateError.message);

    // Staging has done its job and is now a spare copy of the book sitting at
    // the one path a client can write. Best effort: the nightly sweep removes
    // it too, and failing to tidy up must not fail a banked book.
    await supabase.storage
      .from(PREVIEW_BUCKET)
      .remove([stagingPath])
      .then(
        () => undefined,
        () => undefined,
      );

    return Response.json({
      draftId: draft.id,
      expiresAt: purchased ? null : expiresAt.toISOString(),
    });
  } catch (error) {
    return routeError(error, "Your book could not be prepared for sharing.");
  }
}
