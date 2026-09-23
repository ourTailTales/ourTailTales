import { z } from "zod";

import { routeError } from "@/lib/env";
import { requireOrderToken } from "@/lib/order/token";
import { LIMITS, enforceRateLimit } from "@/lib/rate-limit";
import {
  STORAGE_BUCKET,
  orderAssetPath,
  supabaseAdmin,
} from "@/lib/supabase/server";

const requestSchema = z.object({ orderId: z.string().uuid() });

/**
 * Mints short-lived signed upload URLs for one order's two print files.
 *
 * The bucket is private and the service-role key stays on the server; the
 * browser only ever receives these scoped, expiring URLs.
 *
 * Requires the order's token. Without it, anyone who learned an order id could
 * mint an upload URL for somebody else's print files.
 *
 * Note what this does NOT protect: a signed upload URL stays usable for hours
 * after it is minted, so the customer who legitimately owns it can still
 * replace their own print files later, including after paying. That is handled
 * where it has to be, by copying the files to a path no client holds a URL for
 * at the moment payment lands. See `freezePrintFiles`.
 */
export async function POST(request: Request): Promise<Response> {
  try {
    const limited = await enforceRateLimit(request, LIMITS.draft);
    if (limited) return limited;

    const parsed = requestSchema.safeParse(await request.json());
    if (!parsed.success) {
      return Response.json({ error: "Unknown order." }, { status: 400 });
    }

    const { orderId } = parsed.data;
    const unauthorized = requireOrderToken(request, orderId);
    if (unauthorized) return unauthorized;
    const supabase = supabaseAdmin();

    const { data: order, error: lookupError } = await supabase
      .from("orders")
      .select("id, status")
      .eq("id", orderId)
      .maybeSingle();

    if (lookupError) throw new Error(lookupError.message);
    if (!order) {
      return Response.json({ error: "Unknown order." }, { status: 404 });
    }
    if (order.status !== "pending_payment") {
      return Response.json(
        { error: "This order has already been submitted for printing." },
        { status: 409 },
      );
    }

    const interiorPath = orderAssetPath(orderId, "interior");
    const coverPath = orderAssetPath(orderId, "cover");

    const [interior, cover] = await Promise.all([
      signUpload(interiorPath),
      signUpload(coverPath),
    ]);

    const { error: updateError } = await supabase
      .from("orders")
      .update({ interior_path: interiorPath, cover_path: coverPath })
      .eq("id", orderId);

    if (updateError) throw new Error(updateError.message);

    return Response.json({ interior, cover });
  } catch (error) {
    return routeError(error, "Upload URLs could not be created.");
  }
}

async function signUpload(
  path: string,
): Promise<{ path: string; signedUrl: string }> {
  const { data, error } = await supabaseAdmin()
    .storage.from(STORAGE_BUCKET)
    .createSignedUploadUrl(path, { upsert: true });

  if (error || !data) {
    throw new Error(error?.message ?? `Could not sign upload for ${path}`);
  }
  return { path, signedUrl: data.signedUrl };
}
