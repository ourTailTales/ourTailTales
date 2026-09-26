import Link from "next/link";

import { BrandMark } from "@/components/BrandMark";
import { CheckoutNotice } from "@/components/checkout/ui";
import type { CheckoutRefusal } from "@/lib/order/checkout-access";

/** Why this checkout cannot be shown, in the same words on every step. */
export function CheckoutRefused({
  reason,
  orderId,
}: {
  reason: CheckoutRefusal;
  /** Known when the order was found but is past paying for. */
  orderId?: string | null;
}) {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-5 pb-24 pt-10 sm:pt-16">
      <header className="flex items-center justify-between gap-4">
        <BrandMark href="/" size="md" />
        <p className="text-xs font-medium tracking-wide text-ink-faint">Checkout</p>
      </header>

      {reason === "not_configured" ? (
        <CheckoutNotice title="Checkout is not connected yet">
          Supabase credentials are missing, so orders cannot be stored. Add{" "}
          <code className="text-periwinkle-deep">NEXT_PUBLIC_SUPABASE_URL</code> and{" "}
          <code className="text-periwinkle-deep">SUPABASE_SERVICE_ROLE_KEY</code> to{" "}
          <code className="text-periwinkle-deep">.env.local</code> and run the
          migration in <code className="text-periwinkle-deep">supabase/migrations</code>.
        </CheckoutNotice>
      ) : reason === "already_ordered" ? (
        <CheckoutNotice title="This order is already on its way">
          {orderId ? (
            <Link
              href={`/order/${orderId}`}
              className="underline decoration-line underline-offset-4"
            >
              Check its progress
            </Link>
          ) : (
            "Check the link in your confirmation email."
          )}
          .
        </CheckoutNotice>
      ) : reason === "memories_preparing" ? (
        <CheckoutNotice title="Your book is still being prepared">
          Your Video Memories are still being made ready. Head back to your book
          and try ordering again in a moment.
        </CheckoutNotice>
      ) : reason === "print_files_uploading" ? (
        <CheckoutNotice title="Your print files are still uploading">
          Head back to your book and try ordering again in a moment.
        </CheckoutNotice>
      ) : (
        <CheckoutNotice title="We couldn't find that order">
          Start again from the beginning and we&rsquo;ll rebuild your book.{" "}
          <Link href="/" className="underline decoration-line underline-offset-4">
            Back to ourTailTales
          </Link>
          .
        </CheckoutNotice>
      )}
    </main>
  );
}
