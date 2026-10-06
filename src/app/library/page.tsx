import type { Metadata } from "next";
import Link from "next/link";
import { BookOpen, Plus } from "lucide-react";

import { BrandMark } from "@/components/BrandMark";
import { SavedBookSignIn } from "@/components/auth/SavedBookSignIn";
import { SignOutButton } from "@/components/auth/SignOutButton";
import { createPathForEmail } from "@/components/auth/auth-flow";
import { createAuthServerClient } from "@/lib/supabase/auth-server";

export const metadata: Metadata = {
  title: "Your books | ourTailTales",
  robots: { index: false, follow: false },
};

type LibraryRow = {
  id: string;
  pet_name: string;
  cover_preview_path: string | null;
  updated_at: string;
};

/**
 * Every book saved to the signed-in account.
 *
 * The site said "saved to your library" in the sign-up dialog, the FAQ, the
 * emails and the Privacy Policy, and there was nowhere to go and see one: a
 * saved book could only be reached by a link somebody had kept. This is that
 * place. Reads go through the visitor's own session, so the database's row
 * rules decide what is listed and nobody can be shown another account's book.
 */
export default async function LibraryPage() {
  const supabase = await createAuthServerClient();
  const { data: authData } = await supabase.auth.getUser();

  if (!authData.user) {
    return (
      <main className="mx-auto w-full max-w-2xl flex-1 px-5 pb-16 pt-6 sm:px-8">
        <BrandMark href="/" size="md" />
        <SavedBookSignIn
          eyebrow="Your books"
          title="Sign in to see your books"
          body="Books saved to your account are kept here. Sign in with the email you used."
        />
      </main>
    );
  }

  const { data, error } = await supabase
    .from("book_projects")
    .select("id, pet_name, cover_preview_path, updated_at")
    .order("updated_at", { ascending: false })
    .limit(100);
  const books = error ? [] : ((data ?? []) as LibraryRow[]);

  // One call for every cover. They are private files, so each needs a
  // short-lived link of its own.
  const coverPaths = books
    .map((book) => book.cover_preview_path)
    .filter((path): path is string => Boolean(path));
  const coverUrls = new Map<string, string>();
  if (coverPaths.length > 0) {
    const { data: signed } = await supabase.storage
      .from("book-previews")
      .createSignedUrls(coverPaths, 600);
    for (const entry of signed ?? []) {
      if (entry.path && entry.signedUrl) coverUrls.set(entry.path, entry.signedUrl);
    }
  }

  const newBookHref = createPathForEmail(authData.user.email);

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-5 pb-16 pt-6 sm:px-8">
      <header className="flex items-center justify-between gap-4">
        <BrandMark href="/" size="md" />
        <SignOutButton />
      </header>

      <div className="mt-10 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold text-page-ink">
            Your books
          </h1>
          <p className="mt-1 text-sm text-page-ink-soft">
            Signed in as {authData.user.email}
          </p>
        </div>
        <Link
          href={newBookHref}
          className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-periwinkle px-5 py-3 text-sm font-semibold text-white shadow-lift hover:bg-periwinkle-deep"
        >
          <Plus aria-hidden className="size-4" />
          Make a book
        </Link>
      </div>

      {error ? (
        <p
          role="alert"
          className="mt-8 rounded-2xl border border-page-line bg-white p-6 text-sm text-page-ink"
        >
          Your books could not be loaded just now. Reload the page to try
          again.
        </p>
      ) : books.length === 0 ? (
        <section className="mt-8 rounded-[1.75rem] border border-page-line bg-white/95 p-8 text-center">
          <BookOpen aria-hidden className="mx-auto size-8 text-periwinkle" />
          <h2 className="mt-3 font-display text-xl font-bold text-page-ink">
            No saved books yet
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-page-ink-soft">
            A book is saved here when you make it, or open it, while signed
            in on the device that holds its photos.
          </p>
        </section>
      ) : (
        <ul className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {books.map((book) => {
            const cover = book.cover_preview_path
              ? coverUrls.get(book.cover_preview_path)
              : undefined;
            const name = book.pet_name.trim();
            return (
              <li key={book.id}>
                <Link
                  href={`/book/${book.id}`}
                  className="group flex h-full flex-col overflow-hidden rounded-2xl border border-page-line bg-white shadow-sm transition-colors hover:border-periwinkle"
                >
                  <div className="aspect-square w-full bg-periwinkle-wash/40">
                    {cover ? (
                      // eslint-disable-next-line @next/next/no-img-element -- short-lived private signed URL
                      <img
                        src={cover}
                        alt=""
                        loading="lazy"
                        className="size-full object-cover"
                      />
                    ) : (
                      <div className="flex size-full items-center justify-center">
                        <BookOpen aria-hidden className="size-10 text-periwinkle/50" />
                      </div>
                    )}
                  </div>
                  <div className="flex flex-1 flex-col gap-1 p-4">
                    <h2 className="font-display text-lg font-bold text-page-ink group-hover:text-periwinkle-deep">
                      {name ? `${name}’s story` : "Your pet’s story"}
                    </h2>
                    <p className="text-xs text-page-ink-faint">
                      Saved{" "}
                      {new Date(book.updated_at).toLocaleDateString("en-US", {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })}
                    </p>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
