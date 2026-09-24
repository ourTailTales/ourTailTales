import type { Metadata } from "next";
import Link from "next/link";

import { BrandMark } from "@/components/BrandMark";
import { ResetPasswordForm } from "@/app/reset-password/ResetPasswordForm";
import { createAuthServerClient } from "@/lib/supabase/auth-server";

export const metadata: Metadata = {
  title: "Reset your password | ourTailTales",
  robots: { index: false, follow: false },
};

/**
 * Where the "reset your password" email lands, after `/auth/callback`
 * exchanges the emailed code for a session.
 *
 * That exchange is what proves this visitor followed a link that went only to
 * their own inbox, so by the time this renders there is either a fresh
 * session to set a new password on, or there isn't — a stale or already-used
 * link fails the exchange upstream and never reaches this page with a
 * session at all. There is no separate "confirm it's you" step here for the
 * same reason `/claim` skips one: arriving here signed in already is the
 * confirmation.
 */
export default async function ResetPasswordPage() {
  const supabase = await createAuthServerClient();
  const { data: authData } = await supabase.auth.getUser();

  return (
    <main className="mx-auto w-full max-w-lg flex-1 px-5 pb-16 pt-6 sm:px-8">
      <BrandMark href="/" size="md" />

      <section className="mt-8 rounded-[1.75rem] border border-page-line bg-white/95 p-6 shadow-[0_24px_70px_-30px_rgb(25_32_58/0.55)] sm:p-8">
        {authData.user ? (
          <>
            <p className="text-xs font-semibold tracking-[0.16em] text-periwinkle uppercase">
              Your account
            </p>
            <h1 className="mt-1.5 font-display text-3xl font-bold text-page-ink">
              Choose a new password
            </h1>
            <p className="mt-2.5 text-sm leading-6 text-page-ink-soft">
              Pick something you&rsquo;ll remember. You&rsquo;ll stay signed in
              with it right after.
            </p>

            <ResetPasswordForm />
          </>
        ) : (
          <>
            <p className="text-xs font-semibold tracking-[0.16em] text-periwinkle uppercase">
              Link expired
            </p>
            <h1 className="mt-1.5 font-display text-3xl font-bold text-page-ink">
              This reset link didn&rsquo;t work
            </h1>
            <p className="mt-2.5 text-sm leading-6 text-page-ink-soft">
              It may have already been used, or it&rsquo;s more than an hour
              old. Head back and ask for a new one from the sign-in form.
            </p>
            <Link
              href="/"
              className="mt-6 inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-periwinkle px-6 text-base font-semibold text-white shadow-lift hover:bg-periwinkle-deep"
            >
              Back to ourTailTales
            </Link>
          </>
        )}
      </section>
    </main>
  );
}
