import Link from "next/link";
import type { Metadata } from "next";

import { BrandMark } from "@/components/BrandMark";
import { CheckoutForm } from "@/components/CheckoutForm";
import { readEnv } from "@/lib/env";
import { readOrder } from "@/lib/order/read";
import { supabaseConfigured } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Checkout — ourTailTales",
  robots: { index: false, follow: false },
};

export default async function CheckoutPage({
  searchParams,
}: PageProps<"/checkout">) {
  const { order: orderParam } = await searchParams;
  const orderId = typeof orderParam === "string" ? orderParam : null;

  const order = orderId ? await readOrder(orderId) : null;
  const publishableKey = readEnv("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY");

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-5 pb-24 pt-10 sm:pt-16">
      <header className="flex items-center justify-between gap-4">
        <BrandMark href="/" size="md" />
        <p className="text-xs font-medium tracking-wide text-ink-faint">
          Checkout
        </p>
      </header>

      {!supabaseConfigured() ? (
        <Notice title="Checkout is not connected yet">
          Supabase credentials are missing, so orders cannot be stored. Add{" "}
          <code className="text-periwinkle-deep">NEXT_PUBLIC_SUPABASE_URL</code> and{" "}
          <code className="text-periwinkle-deep">SUPABASE_SERVICE_ROLE_KEY</code> to{" "}
          <code className="text-periwinkle-deep">.env.local</code> and run the
          migration in <code className="text-periwinkle-deep">supabase/migrations</code>.
        </Notice>
      ) : !order ? (
        <Notice title="We couldn't find that order">
          Start again from the beginning and we&rsquo;ll rebuild your book.{" "}
          <Link href="/" className="underline decoration-line underline-offset-4">
            Back to ourTailTales
          </Link>
          .
        </Notice>
      ) : order.status !== "pending_payment" ? (
        <Notice title="This order is already on its way">
          <Link
            href={`/order/${order.id}`}
            className="underline decoration-line underline-offset-4"
          >
            Check its progress
          </Link>
          .
        </Notice>
      ) : order.hasVideoMemories && !order.hasFrozenRevision ? (
        <Notice title="Your book is still being prepared">
          Head back to your book and try ordering again in a moment.
        </Notice>
      ) : !order.hasVideoMemories && !order.hasPrintFiles ? (
        <Notice title="Your print files are still uploading">
          Head back to your book and try ordering again in a moment.
        </Notice>
      ) : (
        <CheckoutForm order={order} publishableKey={publishableKey ?? null} />
      )}
    </main>
  );
}

function Notice({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-12 rounded-2xl border border-line bg-white p-8 shadow-lift">
      <h1 className="font-display text-2xl text-ink">{title}</h1>
      <p className="mt-3 text-sm leading-6 text-ink-soft">{children}</p>
    </section>
  );
}
