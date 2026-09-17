import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ExternalLink, LockKeyhole } from "lucide-react";

import { BrandMark } from "@/components/BrandMark";
import { BookViewAnalytics } from "@/components/create/BookViewAnalytics";
import { createAuthServerClient } from "@/lib/supabase/auth-server";

export const metadata: Metadata = {
  title: "Your book — ourTailTales",
  robots: { index: false, follow: false },
};

type BookProjectRow = {
  id: string;
  pet_name: string;
  preview_pdf_path: string;
  cover_preview_path: string | null;
  updated_at: string;
};

export default async function BookPage({ params }: PageProps<"/book/[id]">) {
  const { id } = await params;
  const supabase = await createAuthServerClient();
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) redirect(`/create?book=${encodeURIComponent(id)}`);

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
