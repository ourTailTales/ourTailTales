import { pdfPageCount } from "@/lib/book/pdf-pages";
import { STORAGE_BUCKET, supabaseAdmin } from "@/lib/supabase/server";

/**
 * Checks the interior that is about to be printed against what was paid for.
 *
 * The interior is rendered and uploaded by the customer's browser. The price
 * comes from the chapter count, and `total_pages` on the order is the page
 * count those chapters allow, but nothing looked at the file itself: a
 * tampered browser could pay for five chapters and upload five hundred pages.
 * The printer charges by the page.
 *
 * Run on the frozen copy, after payment, so the file that is counted is the
 * file that is printed and the customer can no longer change it.
 */

export const PRINT_FILE_MISMATCH_REASON =
  "The print file does not match this order. It is being checked by hand before printing.";

export type PrintFileVerdict =
  | { ok: true; pages: number }
  | { ok: false; pages: number | null; detail: string };

/**
 * Whether a file of `pages` pages may be printed for an order of
 * `orderedPages`.
 *
 * Longer than ordered is the case that costs money and is always refused. A
 * file that cannot be read is refused too: it cannot be shown to be within
 * what was paid for. Shorter than ordered is let through, because the printer
 * is told the ordered count and rejects a file that does not match it, which
 * holds the order on its own.
 */
export function printFileVerdict(
  pages: number | null,
  orderedPages: number | null,
): PrintFileVerdict {
  if (pages === null || pages <= 0) {
    return { ok: false, pages, detail: "The interior file could not be read as a PDF." };
  }
  const ordered = Math.floor(Number(orderedPages));
  if (!Number.isFinite(ordered) || ordered <= 0) {
    return { ok: false, pages, detail: "The order has no page count to check against." };
  }
  if (pages > ordered) {
    return {
      ok: false,
      pages,
      detail: `The interior file has ${pages} pages and the order paid for ${ordered}.`,
    };
  }
  return { ok: true, pages };
}

/** Downloads an order's frozen interior and checks its length. */
export async function checkFrozenInterior(orderId: string): Promise<PrintFileVerdict> {
  const supabase = supabaseAdmin();
  const { data: order, error } = await supabase
    .from("orders")
    .select("total_pages, interior_path, frozen_interior_path")
    .eq("id", orderId)
    .maybeSingle();
  if (error) throw new Error(error.message);

  const path = order?.frozen_interior_path ?? order?.interior_path;
  if (!order || !path) {
    return { ok: false, pages: null, detail: "The interior file is missing." };
  }

  const { data: file, error: downloadError } = await supabase.storage
    .from(STORAGE_BUCKET)
    .download(path);
  if (downloadError || !file) {
    return { ok: false, pages: null, detail: "The interior file could not be downloaded." };
  }

  const pages = await pdfPageCount(new Uint8Array(await file.arrayBuffer()));
  return printFileVerdict(pages, order.total_pages);
}
