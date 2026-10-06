"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { createAuthBrowserClient } from "@/lib/supabase/auth-browser";

/** Ends the session on this device and re-renders the page signed out. */
export function SignOutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          await createAuthBrowserClient().auth.signOut();
        } finally {
          router.refresh();
          setBusy(false);
        }
      }}
      className="inline-flex min-h-11 items-center rounded-full border border-page-line bg-white px-4 text-sm font-semibold text-page-ink shadow-sm hover:border-periwinkle disabled:opacity-50"
    >
      {busy ? "Signing out…" : "Sign out"}
    </button>
  );
}
