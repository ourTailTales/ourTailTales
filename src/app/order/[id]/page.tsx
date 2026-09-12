import Link from "next/link";
import type { Metadata } from "next";

import { BrandMark } from "@/components/BrandMark";
import { readOrder, type OrderView } from "@/lib/order/read";
import { formatUsd } from "@/lib/pricing";
import type { OrderStatus } from "@/types/order";

export const metadata: Metadata = {
  title: "Your order — ourTailTales",
  robots: { index: false, follow: false },
};

const TIMELINE: { status: OrderStatus; label: string; body: string }[] = [
  {
    status: "paid",
    label: "Payment confirmed",
    body: "Your book is locked in and nothing else is needed from you.",
  },
  {
    status: "submitted",
    label: "Sent to the printer",
    body: "The interior and cover are with our print partner for checks.",
  },
  {
    status: "production",
    label: "Being printed and bound",
    body: "Pages are printed, the cover is wrapped, and the book is bound.",
  },
  {
    status: "shipped",
    label: "On its way",
    body: "It has left the bindery and is heading to you.",
  },
  {
    status: "delivered",
    label: "Delivered",
    body: "The carrier marked your book as delivered.",
  },
];

const ORDER: OrderStatus[] = [
  "pending_payment",
  "paid",
  "submitted",
  "production",
  "shipped",
  "delivered",
];

export default async function OrderPage({ params }: PageProps<"/order/[id]">) {
  const { id } = await params;
  const order = await readOrder(id);

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-5 pb-24 pt-10 sm:pt-16">
      <header className="flex items-center justify-between gap-4">
        <BrandMark href="/" size="md" />
        <p className="text-xs font-medium tracking-wide text-ink-faint">
          Your order
        </p>
      </header>

      {!order ? (
        <section className="mt-12 rounded-2xl border border-line bg-white p-8 shadow-lift">
          <h1 className="font-display text-2xl text-ink">
            We couldn&rsquo;t find that order
          </h1>
          <p className="mt-3 text-sm leading-6 text-ink-soft">
            Check the link in your confirmation email, or{" "}
            <Link
              href="/"
              className="underline decoration-line underline-offset-4"
            >
              start a new book
            </Link>
            .
          </p>
        </section>
      ) : (
        <OrderDetail order={order} />
      )}
    </main>
  );
}

function OrderDetail({ order }: { order: OrderView }) {
  const currentIndex = ORDER.indexOf(order.status);
  const needsAttention =
    order.status === "needs_review" ||
    order.status === "rejected" ||
    order.status === "canceled";

  return (
    <>
      <section className="mt-10">
        <h1 className="font-display text-3xl text-ink">
          {order.petName ? `${order.petName}'s book` : "Your book"}
        </h1>
        <p className="mt-2 text-sm text-ink-soft">
          {order.chapterCount} chapters · {order.storyPages} story pages plus 4
          complimentary pages · {order.totalPages} printed pages
        </p>
      </section>

      {order.status === "pending_payment" && (
        <Callout tone="warn" title="This order hasn't been paid yet">
          <Link
            href={`/checkout?order=${order.id}`}
            className="underline decoration-line underline-offset-4"
          >
            Finish checkout
          </Link>{" "}
          to send it to print.
        </Callout>
      )}

      {needsAttention && (
        <Callout tone="warn" title="We're looking into this order">
          {order.reviewReason ??
            order.luluStatusMessage ??
            "Something needed a human to check it."}{" "}
          We&rsquo;ll email you at {order.email ?? "your address"} — you don&rsquo;t
          need to do anything, and you won&rsquo;t be charged twice.
        </Callout>
      )}

      {!needsAttention && order.status !== "pending_payment" && (
        <ol className="mt-8 space-y-1">
          {TIMELINE.map((entry) => {
            const entryIndex = ORDER.indexOf(entry.status);
            const done = currentIndex >= entryIndex;
            const active = order.status === entry.status;

            return (
              <li
                key={entry.status}
                className={`flex gap-4 rounded-xl px-4 py-3.5 ${
                  active ? "bg-periwinkle-wash/50" : ""
                }`}
              >
                <span
                  aria-hidden
                  className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${
                    done ? "bg-periwinkle" : "bg-line"
                  }`}
                />
                <span>
                  <span
                    className={`block text-sm ${
                      done ? "font-medium text-ink" : "text-ink-faint"
                    }`}
                  >
                    {entry.label}
                  </span>
                  <span className="mt-0.5 block text-sm leading-6 text-ink-soft">
                    {entry.body}
                  </span>
                  {active &&
                    entry.status === "shipped" &&
                    order.trackingUrls.length > 0 && (
                      <span className="mt-2 block space-y-1">
                        {order.trackingUrls.map((url) => (
                          <a
                            key={url}
                            href={url}
                            target="_blank"
                            rel="noreferrer"
                            className="block text-sm text-periwinkle-deep underline decoration-line underline-offset-4"
                          >
                            Track shipment
                          </a>
                        ))}
                      </span>
                    )}
                </span>
              </li>
            );
          })}
        </ol>
      )}

      <dl className="mt-10 space-y-2.5 rounded-2xl border border-line bg-white p-6 text-sm shadow-lift">
        <Row label="Book" value={formatUsd(order.bookPrice)} />
        <Row
          label="Shipping"
          value={
            order.shippingPrice === null
              ? "—"
              : formatUsd(order.shippingPrice)
          }
        />
        <div className="border-t border-line pt-3" />
        <Row
          label="Total"
          value={formatUsd(order.bookPrice + (order.shippingPrice ?? 0))}
          strong
        />
      </dl>

      <p className="mt-6 text-xs leading-5 text-ink-faint">
        Order reference {order.id.slice(0, 8)}. Your print files are deleted a
        week after your book ships; your original photos never left your device.
      </p>
    </>
  );
}

function Callout({
  tone,
  title,
  children,
}: {
  tone: "warn";
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className={`mt-8 rounded-2xl border p-6 ${
        tone === "warn" ? "border-periwinkle/30 bg-periwinkle-wash/40" : "border-line"
      }`}
    >
      <h2 className="font-display text-lg text-ink">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-ink-soft">{children}</p>
    </section>
  );
}

function Row({
  label,
  value,
  strong,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className={strong ? "font-medium text-ink" : "text-ink-soft"}>{label}</dt>
      <dd
        className={strong ? "font-display text-lg text-ink" : "text-ink"}
      >
        {value}
      </dd>
    </div>
  );
}
