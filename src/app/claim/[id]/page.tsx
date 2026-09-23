import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { BrandMark } from "@/components/BrandMark";
import { ClaimForm } from "@/app/claim/[id]/ClaimForm";
import { loadDraftPreview } from "@/lib/drafts/preview";
import { draftLeadEmail } from "@/lib/drafts/lead";
import { createAuthServerClient } from "@/lib/supabase/auth-server";

export const metadata: Metadata = {
  title: "Open your book | ourTailTales",
  robots: { index: false, follow: false },
};

/**
 * Where the link in the welcome email lands.
 *
 * The customer read their first ten pages in an attachment and came back for
 * the rest, so this page has exactly one job: take a password and let them in.
 * There is no separate "confirm your email" step afterwards, because arriving
 * here at all means they opened a link that went only to their own inbox —
 * that *is* the confirmation, and a second one would strand them one click
 * from the thing they came for.
 */
export default async function ClaimPage({
  params,
  searchParams,
}: PageProps<"/claim/[id]">) {
  const { id } = await params;
  const { k } = await searchParams;
  const secret = typeof k === "string" && k.length > 0 ? k : null;

  const draft = await loadDraftPreview(id, secret);
  if (!draft || !secret) notFound();

  const supabase = await createAuthServerClient();
  const { data: authData } = await supabase.auth.getUser();
  const signedIn = Boolean(authData.user);

  const knownEmail = await draftLeadEmail(id);
  const name = draft.petName.trim();

  return (
    <main className="mx-auto w-full max-w-lg flex-1 px-5 pb-16 pt-6 sm:px-8">
      <BrandMark href="/" size="md" />

      <section className="mt-8 rounded-[1.75rem] border border-page-line bg-white/95 p-6 shadow-[0_24px_70px_-30px_rgb(25_32_58/0.55)] sm:p-8">
        <p className="text-xs font-semibold tracking-[0.16em] text-periwinkle uppercase">
          Your book
        </p>
        <h1 className="mt-1.5 font-display text-3xl font-bold text-page-ink">
          {name ? `${possessive(name)} whole story` : "Your pet’s whole story"}
        </h1>
        <p className="mt-2.5 text-sm leading-6 text-page-ink-soft">
          {draft.chapterCount
            ? `All ${draft.chapterCount} chapters, and every page between them.`
            : "Every chapter, and every page between them."}{" "}
          Pick a password and it opens. Then you can change any of it.
        </p>

        {signedIn ? (
          <div className="mt-6 space-y-3">
            <p className="text-sm text-page-ink-soft">
              You&rsquo;re already signed in.
            </p>
            <Link
              href="/create"
              className="inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-periwinkle px-6 text-base font-semibold text-white shadow-lift hover:bg-periwinkle-deep"
            >
              Open your book
            </Link>
          </div>
        ) : (
          <ClaimForm knownEmail={knownEmail} />
        )}

        {draft.pdfUrl ? (
          <p className="mt-6 border-t border-page-line pt-5 text-xs text-page-ink-faint">
            <a
              href={draft.pdfUrl}
              target="_blank"
              rel="noreferrer"
              className="underline underline-offset-4 hover:text-periwinkle-deep"
            >
              Read the free pages again
            </a>{" "}
            without making an account.
          </p>
        ) : null}
      </section>
    </main>
  );
}

function possessive(name: string): string {
  return /s$/i.test(name.trim()) ? `${name.trim()}’` : `${name.trim()}’s`;
}
