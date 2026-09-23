"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LockKeyhole } from "lucide-react";

import { AuthGate } from "@/components/auth/AuthGate";

/**
 * What a signed-out visitor sees at a saved book's URL.
 *
 * This used to redirect to `/create?book=<id>` — a parameter nothing read —
 * which dropped them into the upload funnel with no explanation and no way
 * back to the book they had clicked. Staying on the URL keeps the link
 * working: sign in and the page they asked for renders.
 */
export function SavedBookSignIn() {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  return (
    <>
      <section className="mt-10 rounded-[1.75rem] border border-page-line bg-white/95 p-8 text-center shadow-[0_24px_70px_-30px_rgb(25_32_58/0.55)]">
        <p className="flex items-center justify-center gap-1.5 text-xs font-semibold tracking-[0.16em] text-periwinkle uppercase">
          <LockKeyhole aria-hidden className="size-3.5" />
          Private book
        </p>
        <h1 className="mt-3 font-display text-3xl font-bold text-page-ink">
          Sign in to open this book
        </h1>
        <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-page-ink-soft">
          This one is saved to an account. Sign in with the email you used and
          it will open here.
        </p>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="mt-7 inline-flex min-h-11 items-center justify-center rounded-xl bg-periwinkle px-6 py-3 text-sm font-semibold text-white shadow-lift hover:bg-periwinkle-deep"
        >
          Sign in
        </button>
      </section>

      {open && (
        <AuthGate
          onClose={() => setOpen(false)}
          onAuthenticated={() => {
            setOpen(false);
            // The page is a server component; re-rendering it is what swaps
            // this panel for the book.
            router.refresh();
          }}
        />
      )}
    </>
  );
}
