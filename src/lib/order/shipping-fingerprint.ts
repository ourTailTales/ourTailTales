import { createHash } from "node:crypto";

import { clampCopies } from "@/lib/pricing";
import { normaliseAddress, type ComparableAddress } from "@/lib/order/shipping-change";

/**
 * A short digest of everything a locked price was quoted on: the address, the
 * delivery speed and the number of copies.
 *
 * The amount on a payment and the delivery details on an order are written by
 * separate calls, and two requests racing each other could leave a payment
 * priced for one speed or address beside a row asking for another. This digest
 * is written onto the payment in the same call that sets its amount, so the
 * two cannot be separated, and the payment webhook compares it with the
 * details the print job is about to be made from.
 *
 * Server only. Not a secret: it proves nothing by itself and is only ever
 * compared with one worked out the same way.
 */
export function shippingFingerprint(details: {
  address: ComparableAddress;
  level: string;
  quantity: number | null | undefined;
}): string {
  const address = normaliseAddress(details.address);
  const parts = [
    address.name,
    address.phone,
    address.street1,
    address.street2 ?? "",
    address.city,
    address.state,
    address.postcode,
    address.country,
    details.level.trim(),
    String(clampCopies(details.quantity)),
  ];
  return createHash("sha256").update(JSON.stringify(parts)).digest("hex").slice(0, 32);
}
