import type { ReactNode } from "react";

import { possessivePetName } from "@/lib/book/pagination";
import { expiryHeadline } from "@/lib/drafts/expiry";

/**
 * "EXPIRES IN 5 DAYS", in big red letters, over every free preview.
 *
 * Loud on purpose, at the owner's request: a preview nobody saves is deleted,
 * and the calm grey line this replaced was easy to read past. The same words
 * are printed across the top of the teaser PDF's cover.
 *
 * No hooks, so it renders on the emailed-link page (a server component) and
 * in the studio alike. The count is in whole days, so it does not need a
 * ticking clock to stay honest.
 */
export function ExpiryBanner({
  expiresAt,
  petName,
  action,
}: {
  expiresAt: Date;
  petName: string;
  /** The way to an account: a button in the studio, a link elsewhere. */
  action?: ReactNode;
}) {
  const whose = petName.trim() ? `${possessivePetName(petName)} book` : "this book";

  return (
    <div
      role="status"
      className="flex flex-col items-center gap-3 rounded-2xl border-2 border-red-600/80 bg-white px-5 py-5 text-center shadow-sm sm:py-6"
    >
      <p className="font-sans text-3xl font-black leading-none tracking-tight text-red-600 sm:text-5xl">
        {expiryHeadline(expiresAt)}
      </p>
      <p className="max-w-xl text-sm leading-6 text-page-ink-soft sm:text-base">
        This is a free preview. Create a free account to save {whose} for
        good, otherwise it is deleted when the time runs out.
      </p>
      {action}
    </div>
  );
}
