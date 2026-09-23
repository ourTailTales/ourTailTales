import { createHmac, timingSafeEqual } from "node:crypto";

import { readEnv, routeError } from "@/lib/env";
import { sendShippingNotificationEmail } from "@/lib/email/send";
import { mapLuluStatus } from "@/lib/lulu/client";
import { supabaseAdmin } from "@/lib/supabase/server";

/**
 * Lulu print-job status updates.
 *
 * The HMAC is verified against the raw request body before any JSON parsing,
 * and a rejected job is flagged for review rather than silently resubmitted.
 *
 * Lulu signs with the owning API client secret for this environment — use
 * LULU_CLIENT_SECRET (or an optional LULU_WEBHOOK_SECRET override).
 */
export async function POST(request: Request): Promise<Response> {
  try {
    const secret =
      readEnv("LULU_WEBHOOK_SECRET") ?? readEnv("LULU_CLIENT_SECRET");
    if (!secret) {
      return Response.json(
        { error: "Lulu webhooks are not configured." },
        { status: 503 },
      );
    }

    // Verify against the exact bytes Lulu signed, before parsing.
    const rawBody = await request.text();
    const signature = request.headers.get("Lulu-HMAC-SHA256");

    if (!signature || !isValidSignature(rawBody, signature, secret)) {
      console.error("[ourTailTales] Lulu HMAC rejected");
      return Response.json({ error: "Invalid signature." }, { status: 401 });
    }

    const payload = JSON.parse(rawBody) as {
      topic?: string;
      data?: {
        id?: number | string;
        external_id?: string;
        status?: { name?: string; message?: string };
        tracking_id?: string | null;
        tracking_urls?: string[];
      };
    };

    if (payload.topic && payload.topic !== "PRINT_JOB_STATUS_CHANGED") {
      return Response.json({ received: true });
    }

    const printJobId = payload.data?.id;
    const luluStatus = payload.data?.status?.name;
    if (printJobId === undefined || !luluStatus) {
      return Response.json({ error: "Unrecognised payload." }, { status: 400 });
    }

    const status = mapLuluStatus(luluStatus);
    if (!status) return Response.json({ received: true });

    const update: Record<string, unknown> = {
      status: status === "rejected" ? "needs_review" : status,
      lulu_status: luluStatus,
      lulu_status_message: payload.data?.status?.message ?? null,
    };

    if (payload.data?.tracking_urls?.length) {
      update.tracking_urls = payload.data.tracking_urls;
    }

    if (status === "rejected") {
      update.review_reason = `Lulu rejected the job: ${
        payload.data?.status?.message ?? "no reason given"
      }`;
      console.error(
        "[ourTailTales] Lulu rejected print job",
        printJobId,
        payload.data?.status?.message,
      );
    }

    const { data: updated, error } = await supabaseAdmin()
      .from("orders")
      .update(update)
      .eq("lulu_print_job_id", String(printJobId))
      // Only a row that was not already shipped comes back, so a repeated
      // webhook cannot send the notification twice.
      .neq("status", "shipped")
      .select("id, email, pet_name")
      .maybeSingle();

    if (error) throw new Error(error.message);

    if (status === "shipped" && updated?.email) {
      void sendShippingNotificationEmail({
        to: updated.email,
        petName: updated.pet_name ?? "",
        orderId: updated.id,
        trackingUrl: payload.data?.tracking_urls?.[0] ?? null,
      }).catch((sendError: unknown) => {
        console.error("[ourTailTales] Shipping email failed", updated.id, sendError);
      });
    }

    return Response.json({ received: true });
  } catch (error) {
    return routeError(error, "Lulu webhook handling failed.");
  }
}

/** Lulu documents base64; hex is accepted defensively. */
function isValidSignature(
  rawBody: string,
  signature: string,
  secret: string,
): boolean {
  const digest = createHmac("sha256", secret).update(rawBody, "utf8").digest();
  return (
    safeEquals(signature, digest.toString("base64")) ||
    safeEquals(signature, digest.toString("hex"))
  );
}

function safeEquals(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}
