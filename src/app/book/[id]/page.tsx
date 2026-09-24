import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Download, ExternalLink, LockKeyhole } from "lucide-react";

import { BrandMark } from "@/components/BrandMark";
import { ExpiryBanner } from "@/components/ExpiryBanner";
import { SavedBookSignIn } from "@/components/auth/SavedBookSignIn";
import { BookViewAnalytics } from "@/components/create/BookViewAnalytics";
import { UpgradeActions } from "./UpgradeActions";
import { loadDraftPreview, type DraftPreview } from "@/lib/drafts/preview";
import { BASE_PRICE, DIGITAL_PRICE } from "@/lib/pricing";
import { createAuthServerClient } from "@/lib/supabase/auth-server";


export const metadata: Metadata = {
  title: "Your book | ourTailTales",
  robots: { index: false, follow: false },
};

type BookProjectRow = {
  id: string;
  pet_name: string;
  preview_pdf_path: string;
  cover_preview_path: string | null;
  updated_at: string;
};

/**
 * One book URL, two kinds of book.
 *
 * A free preview is identified by its draft secret in `?k=`, is public to
 * anyone holding that link, and is what the emailed "view your book" link
 * points at. Everything else is a saved book project, which still requires the
 * owner to be signed in. The draft lookup runs first and returns null for a
 * missing or wrong key, so a bad link is indistinguishable from an unknown id.
 */
export default async function BookPage({
  params,
  searchParams,
}: PageProps<"/book/[id]">) {
  const { id } = await params;
  const { k, purchased } = await searchParams;
  const secret = typeof k === "string" && k.length > 0 ? k : null;

  const draft = await loadDraftPreview(id, secret);
  if (draft) {
    return (
      <FreeBookPreview
        draft={draft}
        secret={secret!}
        justPurchased={purchased === "true"}
      />
    );
  }

  return <SavedBookProject id={id} />;
}

async function SavedBookProject({ id }: { id: string }) {
  const supabase = await createAuthServerClient();
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) {
    return (
      <main className="mx-auto w-full max-w-2xl flex-1 px-5 pb-16 pt-6 sm:px-8">
        <BrandMark href="/" size="md" />
        <SavedBookSignIn />
      </main>
    );
  }

  const { data, error } = await supabase
    .from("book_projects")
    .select("id, pet_name, preview_pdf_path, cover_preview_path, updated_at")
    .eq("id", id)
    .single();
  if (error || !data) notFound();
  const book = data as BookProjectRow;

  const { data: previewData, error: previewError } = await supabase.storage
    .from("book-previews")
    .createSignedUrl(book.preview_pdf_path, 600);
  if (previewError || !previewData) notFound();

  let coverUrl: string | null = null;
  if (book.cover_preview_path) {
    const { data: coverData } = await supabase.storage
      .from("book-previews")
      .createSignedUrl(book.cover_preview_path, 600);
    coverUrl = coverData?.signedUrl ?? null;
  }

  const title = book.pet_name.trim()
    ? `${possessive(book.pet_name)} story`
    : "Your pet’s story";

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-5 pb-16 pt-6 sm:px-8">
      <BookViewAnalytics />
      <header className="flex items-center justify-between gap-4">
        <BrandMark href="/" size="md" />
        <Link
          href="/create"
          className="rounded-full border border-page-line bg-white px-4 py-2 text-sm font-semibold text-page-ink shadow-sm hover:border-periwinkle"
        >
          Create another book
        </Link>
      </header>

      <section className="mt-8 overflow-hidden rounded-[1.75rem] border border-white/80 bg-white/95 shadow-[0_24px_70px_-30px_rgb(25_32_58/0.55)]">
        <div className="flex flex-col gap-5 border-b border-page-line p-5 sm:flex-row sm:items-center sm:justify-between sm:p-7">
          <div className="flex items-center gap-4">
            {coverUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- short-lived private signed URL
              <img
                src={coverUrl}
                alt=""
                className="size-16 rounded-lg object-cover shadow-sm"
              />
            ) : null}
            <div>
              <p className="text-xs font-semibold tracking-[0.16em] text-periwinkle uppercase">
                Your private book
              </p>
              <h1 className="mt-1 font-display text-3xl font-bold text-page-ink">
                {title}
              </h1>
              <p className="mt-1 flex items-center gap-1.5 text-xs text-page-ink-faint">
                <LockKeyhole aria-hidden className="size-3.5" />
                Only your signed-in account can open this link
              </p>
            </div>
          </div>
          <a
            href={previewData.signedUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-periwinkle px-5 py-3 text-sm font-semibold text-white shadow-lift hover:bg-periwinkle-deep"
          >
            Open PDF
            <ExternalLink aria-hidden className="size-4" />
          </a>
        </div>

        <div className="bg-page-line/30 p-3 sm:p-6">
          <iframe
            title={title}
            src={`${previewData.signedUrl}#view=FitH`}
            className="h-[72dvh] min-h-[34rem] w-full rounded-xl bg-white shadow-inner"
          />
        </div>
      </section>
    </main>
  );
}

function possessive(name: string): string {
  return /s$/i.test(name.trim()) ? `${name.trim()}’` : `${name.trim()}’s`;
}

function FreeBookPreview({
  draft,
  secret,
  justPurchased,
}: {
  draft: DraftPreview;
  secret: string;
  justPurchased: boolean;
}) {
  // Stripe redirects the moment it takes the money, which can beat the webhook
  // that actually grants access. Showing the upgrade CTA to someone who has
  // just paid reads as though the payment failed, so this waits it out.
  const settling = justPurchased && !draft.purchased;
  const title = draft.petName
    ? `${possessive(draft.petName)} story`
    : "Your pet’s story";

  if (draft.expired || !draft.pdfUrl) {
    return (
      <main className="mx-auto w-full max-w-2xl flex-1 px-5 pb-16 pt-6 sm:px-8">
        <BrandMark href="/" size="md" />
        <section className="mt-10 rounded-[1.75rem] border border-page-line bg-white/95 p-8 text-center shadow-[0_24px_70px_-30px_rgb(25_32_58/0.55)]">
          <h1 className="font-display text-3xl font-bold text-page-ink">
            This preview has expired
          </h1>
          <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-page-ink-soft">
            Free previews are kept for 30 days. This one has passed that, so the
            file has been deleted. Your photos never left your own device, so
            nothing else was stored.
          </p>
          <Link
            href="/create"
            className="mt-7 inline-flex min-h-11 items-center justify-center rounded-xl bg-periwinkle px-6 py-3 text-sm font-semibold text-white shadow-lift hover:bg-periwinkle-deep"
          >
            Make a new book
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-5 pb-16 pt-6 sm:px-8">
      <BookViewAnalytics />
      <header className="flex items-center justify-between gap-4">
        <BrandMark href="/" size="md" />
        <Link
          href="/create"
          className="rounded-full border border-page-line bg-white px-4 py-2 text-sm font-semibold text-page-ink shadow-sm hover:border-periwinkle"
        >
          Create another book
        </Link>
      </header>

      {draft.expiresAt && !draft.purchased && !settling ? (
        <div className="mt-8">
          <ExpiryBanner
            expiresAt={draft.expiresAt}
            petName={draft.petName ?? ""}
            action={
              <Link
                href={`/claim/${draft.draftId}?k=${encodeURIComponent(secret)}`}
                className="inline-flex min-h-11 items-center justify-center rounded-xl bg-periwinkle px-6 text-sm font-semibold text-white shadow-lift hover:bg-periwinkle-deep"
              >
                Create my free account
              </Link>
            }
          />
        </div>
      ) : null}

      <section className="mt-8 overflow-hidden rounded-[1.75rem] border border-white/80 bg-white/95 shadow-[0_24px_70px_-30px_rgb(25_32_58/0.55)]">
        <div className="flex flex-col gap-5 border-b border-page-line p-5 sm:flex-row sm:items-center sm:justify-between sm:p-7">
          <div>
            <p className="text-xs font-semibold tracking-[0.16em] text-periwinkle uppercase">
              {draft.purchased ? "Your book" : "Your first pages"}
            </p>
            <h1 className="mt-1 font-display text-3xl font-bold text-page-ink">
              {title}
            </h1>
            <p className="mt-1 text-sm text-page-ink-soft">
              {draft.chapterCount
                ? `${draft.chapterCount} chapters`
                : "Their life, in chapters."}
            </p>
          </div>
          <a
            href={draft.pdfUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-page-line bg-white px-5 py-3 text-sm font-semibold text-page-ink shadow-sm hover:border-periwinkle"
          >
            <Download aria-hidden className="size-4" />
            Download PDF
          </a>
        </div>

        <div className="bg-page-line/30 p-3 sm:p-6">
          <iframe
            title={title}
            src={`${draft.pdfUrl}#view=FitH`}
            className="h-[72dvh] min-h-[34rem] w-full rounded-xl bg-white shadow-inner"
          />
        </div>
      </section>

      {settling && (
        <section className="mt-6 rounded-[1.5rem] border border-sage bg-sage/20 p-5 sm:p-7">
          <h2 className="font-display text-xl font-bold text-page-ink">
            Payment received, thank you
          </h2>
          <p className="mt-1.5 max-w-prose text-sm leading-6 text-page-ink-soft">
            Your clean copy is being unlocked now. Refresh this page in a
            moment and the watermark will be gone. We&rsquo;ve emailed you the
            link too, so there is nothing to keep track of.
          </p>
        </section>
      )}

      {!draft.purchased && !settling && (
        <section className="mt-6 rounded-[1.5rem] border border-periwinkle/25 bg-white/95 p-5 sm:p-7">
          <h2 className="font-display text-xl font-bold text-page-ink">
            Read the whole book
          </h2>
          <p className="mt-1.5 max-w-prose text-sm leading-6 text-page-ink-soft">
            These are the first pages. The rest is already written. Make your
            free account and every page opens, stays in your library, and
            becomes yours to change.
          </p>
          <Link
            href={`/claim/${draft.draftId}?k=${encodeURIComponent(secret)}`}
            className="mt-5 inline-flex min-h-12 items-center justify-center rounded-xl bg-periwinkle px-6 text-base font-semibold text-white shadow-lift hover:bg-periwinkle-deep"
          >
            Open the whole book
          </Link>

          <div className="mt-6 border-t border-page-line pt-5">
            <p className="max-w-prose text-sm leading-6 text-page-ink-soft">
              Or go straight to the printed one.
            </p>
            <div className="mt-4">
              <UpgradeActions
                draftId={draft.draftId}
                secret={secret}
                digitalPrice={DIGITAL_PRICE}
                hardcoverPrice={BASE_PRICE}
              />
            </div>
          </div>
        </section>
      )}
    </main>
  );
}

