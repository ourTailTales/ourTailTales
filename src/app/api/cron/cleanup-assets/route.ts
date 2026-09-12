import { readEnv, routeError } from "@/lib/env";
import { STORAGE_BUCKET, supabaseAdmin } from "@/lib/supabase/server";

/**
 * Daily cleanup of temporary print files.
 *
 * Print PDFs are a means to an end, not an archive. Anything older than a week
 * is deleted unless the order still needs it.
 */

const RETENTION_DAYS = 7;

/** Orders that may still need their files: never delete these. */
const KEEP_STATUSES = [
  "paid",
  "submitted",
  "production",
  "needs_review",
  "rejected",
];

export async function GET(request: Request): Promise<Response> {
  try {
    const cronSecret = readEnv("CRON_SECRET");
    if (cronSecret) {
      const authorized =
        request.headers.get("authorization") === `Bearer ${cronSecret}`;
      if (!authorized) {
        return Response.json({ error: "Unauthorized." }, { status: 401 });
      }
    }

    const supabase = supabaseAdmin();
    const cutoff = new Date(
      Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000,
    ).toISOString();

    const { data: orders, error } = await supabase
      .from("orders")
      .select("id, status, interior_path, cover_path")
      .lt("created_at", cutoff)
      .not("status", "in", `(${KEEP_STATUSES.join(",")})`)
      .or("interior_path.not.is.null,cover_path.not.is.null");

    if (error) throw new Error(error.message);

    const paths = (orders ?? []).flatMap((order) =>
      [order.interior_path, order.cover_path].filter(
        (path): path is string => typeof path === "string" && path.length > 0,
      ),
    );

    if (paths.length === 0) {
      return Response.json({ deleted: 0, orders: 0 });
    }

    const { error: removeError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .remove(paths);

    if (removeError) throw new Error(removeError.message);

    const { error: clearError } = await supabase
      .from("orders")
      .update({ interior_path: null, cover_path: null })
      .in(
        "id",
        (orders ?? []).map((order) => order.id),
      );

    if (clearError) throw new Error(clearError.message);

    return Response.json({ deleted: paths.length, orders: orders?.length ?? 0 });
  } catch (error) {
    return routeError(error, "Cleanup failed.");
  }
}
