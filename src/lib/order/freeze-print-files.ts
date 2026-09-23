import { STORAGE_BUCKET, orderAssetPath, supabaseAdmin } from "@/lib/supabase/server";

/**
 * Takes the print files out of the customer's reach, the moment they pay.
 *
 * The browser uploads the interior and the cover through signed URLs, and a
 * signed upload URL stays usable for a couple of hours after it is minted,
 * with upsert on. Nothing about paying invalidates it. So without this, a
 * customer could pay for the book on their screen and then replace the bytes
 * at the same path, and on the Video Memory path — where Lulu is not called
 * until archival finishes, often much later — whatever happened to be sitting
 * there at submission time is what got printed and posted.
 *
 * Checking the file at payment time would not help either: the check and the
 * print are minutes or hours apart, and the file can change in between. The
 * only thing that actually closes it is copying the bytes somewhere no client
 * holds a URL for, and printing from there.
 *
 * Idempotent, because the webhook it runs from is retried. Returns false when
 * there was nothing to freeze, which the caller should treat as "these print
 * files are missing" rather than as success.
 */
export async function freezePrintFiles(orderId: string): Promise<boolean> {
  const supabase = supabaseAdmin();

  const { data: order, error } = await supabase
    .from("orders")
    .select("id, interior_path, cover_path, frozen_interior_path")
    .eq("id", orderId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!order) return false;

  const frozenInterior = orderAssetPath(orderId, "frozen-interior");
  const frozenCover = orderAssetPath(orderId, "frozen-cover");

  // Already done by an earlier delivery of the same webhook.
  if (order.frozen_interior_path === frozenInterior) return true;

  // On the Video Memory path the freeze route has already moved the interior
  // pointer across and blanked the upload one, so the live file is whichever
  // of the two is still set.
  const sourceInterior = order.interior_path ?? order.frozen_interior_path;
  const sourceCover = order.cover_path;
  if (!sourceInterior || !sourceCover) return false;

  await copy(sourceInterior, frozenInterior);
  await copy(sourceCover, frozenCover);

  const { error: updateError } = await supabase
    .from("orders")
    .update({
      frozen_interior_path: frozenInterior,
      cover_path: frozenCover,
      // Left null where it already was: on the Video Memory path that null is
      // what says the interior has still to be rebuilt with its QR codes.
      ...(order.interior_path ? { interior_path: frozenInterior } : {}),
    })
    .eq("id", orderId);

  if (updateError) throw new Error(updateError.message);
  return true;
}

async function copy(from: string, to: string): Promise<void> {
  const storage = supabaseAdmin().storage.from(STORAGE_BUCKET);
  // A retry after a half-finished run finds the destination already there,
  // and copy refuses to overwrite. Clearing first makes the whole thing
  // repeatable.
  await storage.remove([to]).then(
    () => undefined,
    () => undefined,
  );
  const { error } = await storage.copy(from, to);
  if (error) throw new Error(`Could not freeze ${from}: ${error.message}`);
}
