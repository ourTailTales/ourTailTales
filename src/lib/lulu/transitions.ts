import type { mapLuluStatus } from "@/lib/lulu/client";

export type MappedLuluStatus = NonNullable<ReturnType<typeof mapLuluStatus>>;

/**
 * The statuses an order may be in for a printer event to move it to `next`.
 *
 * Forward only. An event is applied to an order that is still behind it, so a
 * repeated or late one cannot move a delivered book back to shipped, send the
 * shipped email twice, or lift a hold that a refund, a dispute or a person put
 * on the order.
 */
export function allowedFrom(next: MappedLuluStatus): string[] {
  switch (next) {
    case "submitted":
      return ["submitted"];
    case "production":
      return ["submitted"];
    case "shipped":
      return ["submitted", "production"];
    case "delivered":
      return ["submitted", "production", "shipped"];
    case "rejected":
    case "canceled":
      return ["submitted", "production"];
  }
}
