import { clampCopies } from "@/lib/pricing";

/** The address fields a shipping quote depends on, as stored or as sent. */
export type ComparableAddress = {
  name: string;
  phone: string;
  street1: string;
  street2?: string | null;
  city: string;
  state: string;
  postcode: string;
  country: string;
};

export type ShippingDetails = {
  address: ComparableAddress | null;
  /** Empty and null both mean no delivery speed has been chosen. */
  level: string | null;
  quantity: number | null;
};

const text = (value: string | null | undefined): string => (value ?? "").trim();

/** One address in the shape two of them can be compared in. */
export function normaliseAddress(address: ComparableAddress): ComparableAddress {
  return {
    name: text(address.name),
    phone: text(address.phone),
    street1: text(address.street1),
    // Stored as null when empty and sent as "", which are the same address.
    street2: text(address.street2) || null,
    city: text(address.city),
    state: text(address.state).toUpperCase(),
    postcode: text(address.postcode),
    country: text(address.country).toUpperCase(),
  };
}

export function addressChanged(
  saved: ComparableAddress | null,
  next: ComparableAddress,
): boolean {
  if (!saved) return true;
  const before = normaliseAddress(saved);
  const after = normaliseAddress(next);
  return (Object.keys(after) as (keyof ComparableAddress)[]).some(
    (field) => before[field] !== after[field],
  );
}

/**
 * Whether a save changes anything the locked price was quoted on.
 *
 * The address, the delivery speed and the number of copies decide what
 * shipping costs. A save that carries the same values back, which every trip
 * through the address step does, must leave the locked price alone: clearing
 * it left an honest customer holding a payment page whose amount no longer
 * matched the order. A part that is left out of `next` is not being changed.
 */
export function shippingDetailsChanged(
  saved: ShippingDetails,
  next: {
    address?: ComparableAddress | null;
    level?: string | null;
    quantity?: number | null;
  },
): boolean {
  if (next.address && addressChanged(saved.address, next.address)) return true;
  if (
    next.level !== undefined &&
    next.level !== null &&
    text(next.level) !== text(saved.level)
  ) {
    return true;
  }
  if (
    next.quantity !== undefined &&
    next.quantity !== null &&
    clampCopies(next.quantity) !== clampCopies(saved.quantity)
  ) {
    return true;
  }
  return false;
}
