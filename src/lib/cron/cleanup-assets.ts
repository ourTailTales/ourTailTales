import { STORAGE_BUCKET, supabaseAdmin } from "@/lib/supabase/server";

/**
 * Daily cleanup of print files.
 *
 * Print PDFs are a means to an end, not an archive, but the end is later than
 * the day the book ships. A book that arrives damaged or misprinted is
 * reprinted free if we are told within 30 days of delivery, and a reprint
 * needs the files. So a finished order keeps them for 60 days from the day it
 * was placed, which covers printing, shipping and the 30 days after, and is
 * what the Privacy Policy says. An order nobody paid for keeps them a week.
 */

/** Abandoned checkouts: nothing was bought, so nothing is owed. */
const UNPAID_RETENTION_DAYS = 7;

/** Finished orders: long enough to honour the reprint promise. */
const FINISHED_RETENTION_DAYS = 60;

const UNPAID_STATUSES = ["pending_payment"];
const FINISHED_STATUSES = ["shipped", "delivered", "canceled"];

/*
 * Every other status (paid, submitted, production, needs_review, rejected) is
 * an order that may still need its files, and is never touched here.
 */

const daysAgo = (days: number): string =>
  new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

/**
 * Extracted from the route handler so the daily dispatcher can call it
 * directly, without a second HTTP hop or a second cold start.
 */
export async function cleanupAssets(): Promise<Record<string, unknown>> {
  const supabase = supabaseAdmin();

  const stale = (statuses: string[], days: number) =>
    supabase
      .from("orders")
      .select("id, status, interior_path, cover_path")
      .lt("created_at", daysAgo(days))
      .in("status", statuses)
      .or("interior_path.not.is.null,cover_path.not.is.null");

  const [unpaid, finished] = await Promise.all([
    stale(UNPAID_STATUSES, UNPAID_RETENTION_DAYS),
    stale(FINISHED_STATUSES, FINISHED_RETENTION_DAYS),
  ]);

  const error = unpaid.error ?? finished.error;
  const orders = [...(unpaid.data ?? []), ...(finished.data ?? [])];

  if (error) throw new Error(error.message);

  const paths = orders.flatMap((order) =>
    [order.interior_path, order.cover_path].filter(
      (path): path is string => typeof path === "string" && path.length > 0,
    ),
  );

  if (paths.length === 0) {
    return { deleted: 0, orders: 0 };
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
      orders.map((order) => order.id),
    );

  if (clearError) throw new Error(clearError.message);

  return { deleted: paths.length, orders: orders.length };
}
