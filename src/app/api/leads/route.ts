import { z } from "zod";

import { routeError } from "@/lib/env";
import { BASE_CHAPTERS, MAX_CHAPTERS, bookPrice } from "@/lib/pricing";
import { supabaseAdmin, supabaseConfigured } from "@/lib/supabase/server";

// Only the address is required. The book context is useful for follow-up but a
// lead is worth keeping without it, so it must never be a reason to reject.
const requestSchema = z.object({
  email: z.email().max(200),
  petName: z.string().max(80).optional().default(""),
  chapterCount: z
    .number()
    .int()
    .min(BASE_CHAPTERS)
    .max(MAX_CHAPTERS)
    .optional(),
  photoCount: z.number().int().nonnegative().optional(),
});

export async function POST(request: Request): Promise<Response> {
  try {
    const parsed = requestSchema.safeParse(await request.json());
    if (!parsed.success) {
      const badEmail = parsed.error.issues.some(
        (issue) => issue.path[0] === "email",
      );
      return Response.json(
        {
          error: badEmail
            ? "That email address doesn't look right."
            : "Please check your details and try again.",
        },
        { status: 400 },
      );
    }

    // The sample is generated in the browser, so a missing database must not
    // block the customer. It is still a deployment error worth shouting about.
    if (!supabaseConfigured()) {
      console.error(
        "[ourTailTales] Lead captured but Supabase is not configured; it was not stored.",
      );
      return Response.json({ stored: false, reason: "not_configured" });
    }

    const lead = parsed.data;
    const { error } = await supabaseAdmin()
      .from("leads")
      .upsert(
        {
          email: lead.email.toLowerCase().trim(),
          pet_name: lead.petName || null,
          chapter_count: lead.chapterCount ?? null,
          quoted_price:
            lead.chapterCount === undefined ? null : bookPrice(lead.chapterCount),
          photo_count: lead.photoCount ?? null,
          last_seen_at: new Date().toISOString(),
        },
        { onConflict: "email" },
      );

    if (error) throw new Error(error.message);

    return Response.json({ stored: true });
  } catch (error) {
    return routeError(error, "Could not save that email address.");
  }
}
