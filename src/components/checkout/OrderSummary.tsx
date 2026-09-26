import { formatUsd, storedPriceBreakdown } from "@/lib/pricing";
import type { OrderView } from "@/lib/order/read";

/** What is being bought, beside every step of buying it. */
export function OrderSummary({
  order,
  shippingPrice,
}: {
  order: OrderView;
  /** Null until a delivery speed has been chosen. */
  shippingPrice: number | null;
}) {
  const total = order.bookPrice + order.videoMemoryPrice + (shippingPrice ?? 0);
  // Chapters are billed band by band; the rate each band was charged at is
  // shown rather than folded into one number.
  const bands = storedPriceBreakdown(order.chapterCount, order.bookPrice);

  return (
    <aside className="h-fit rounded-2xl border border-line bg-white p-6 shadow-lift">
      <h2 className="font-display text-lg text-ink">Your book</h2>
      <dl className="mt-4 space-y-2.5 text-sm">
        <Row label={`${order.petName ?? "Pet"} · hardcover 8.5 × 8.5 in`} />
        <Row label={`${order.chapterCount} chapters · ${order.storyPages} story pages`} />
        <Row label={`Plus 4 complimentary pages (${order.totalPages} total)`} />
        <div className="border-t border-line pt-3" />
        <Row label="Book" value={formatUsd(order.bookPrice)} />
        {bands.map((line) => (
          <Row
            key={line.tier.id}
            label={`${line.tier.name} · ${line.chapters} × ${formatUsd(line.ratePerChapter)} a chapter`}
            value={formatUsd(line.subtotal)}
            indented
          />
        ))}
        {order.hasVideoMemories ? (
          <Row
            label={`Video Memories × ${order.videoMemoryPackCount}`}
            value={formatUsd(order.videoMemoryPrice)}
          />
        ) : null}
        <Row
          label="Shipping"
          value={shippingPrice === null ? "Calculated next" : formatUsd(shippingPrice)}
        />
        <div className="border-t border-line pt-3" />
        <Row label="Total" value={formatUsd(total)} strong />
      </dl>
      <p className="mt-4 text-xs leading-5 text-ink-faint">
        Printed and bound to order. Your photos were never uploaded to build this
        book, only the finished print files were.
      </p>
    </aside>
  );
}

function Row({
  label,
  value,
  strong,
  indented,
}: {
  label: string;
  value?: string;
  strong?: boolean;
  /** A band of the line above it, not a charge of its own. */
  indented?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt
        className={`${strong ? "font-medium text-ink" : "text-ink-soft"}${
          indented ? " pl-4 text-xs text-ink-faint" : ""
        }`}
      >
        {label}
      </dt>
      {value ? (
        <dd
          className={`${
            strong ? "font-display text-lg text-ink" : "whitespace-nowrap text-ink"
          }${indented ? " text-xs text-ink-faint" : ""}`}
        >
          {value}
        </dd>
      ) : null}
    </div>
  );
}
