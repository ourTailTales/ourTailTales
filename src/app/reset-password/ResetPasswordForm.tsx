"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import {
  authErrorCopy,
  createPathForEmail,
  MIN_PASSWORD_LENGTH,
  PASSWORD_HINT,
  PASSWORD_TOO_SHORT,
} from "@/components/auth/auth-flow";
import { createAuthBrowserClient } from "@/lib/supabase/auth-browser";

/**
 * New password, typed twice.
 *
 * The confirmation field earns its keep here in a way it doesn't during
 * sign-up: this password replaces one the customer is actively trying to
 * recover from, so a typo that silently locks them out again is worse than
 * one extra box.
 */
export function ResetPasswordForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  /** Whose book to go back to. Known the moment the password is saved. */
  const [sessionEmail, setSessionEmail] = useState<string | null>(null);

  const submit = async (): Promise<void> => {
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(PASSWORD_TOO_SHORT);
      return;
    }
    if (password !== confirm) {
      setError("Those two passwords don't match.");
      return;
    }

    setWorking(true);
    setError(null);
    try {
      const supabase = createAuthBrowserClient();
      const { data, error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) {
        setWorking(false);
        setError(authErrorCopy(updateError));
        return;
      }
      // The local book is filed under the address it was made with, so the
      // editor has to be asked for that address or it opens an empty one.
      // An account with no address gets the plain editor, not `?email=`.
      setSessionEmail(data.user?.email?.trim() || null);
      setDone(true);
      router.refresh();
    } catch (caught) {
      setWorking(false);
      setError(authErrorCopy(caught));
    }
  };

  if (done) {
    return (
      <div className="mt-6 space-y-4">
        <p role="status" className="text-sm leading-6 text-page-ink-soft">
          Your password is updated. You are still signed in.
        </p>
        <button
          type="button"
          onClick={() => router.push(createPathForEmail(sessionEmail))}
          className="inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-periwinkle px-6 text-base font-semibold text-white shadow-lift hover:bg-periwinkle-deep"
        >
          Continue to my book
        </button>
      </div>
    );
  }

  return (
    <form
      className="mt-6 space-y-3"
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <div>
        <label htmlFor="newPassword" className="block text-sm font-medium text-page-ink">
          New password
        </label>
        <input
          id="newPassword"
          type="password"
          autoComplete="new-password"
          autoFocus
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          disabled={working}
          className="mt-1 min-h-11 w-full rounded-xl border border-page-line px-3 text-base text-page-ink outline-none focus:border-periwinkle disabled:opacity-60"
        />
        <p className="mt-1.5 text-xs text-page-ink-faint">{PASSWORD_HINT}</p>
      </div>

      <div>
        <label htmlFor="confirmPassword" className="block text-sm font-medium text-page-ink">
          Confirm password
        </label>
        <input
          id="confirmPassword"
          type="password"
          autoComplete="new-password"
          value={confirm}
          onChange={(event) => setConfirm(event.target.value)}
          disabled={working}
          className="mt-1 min-h-11 w-full rounded-xl border border-page-line px-3 text-base text-page-ink outline-none focus:border-periwinkle disabled:opacity-60"
        />
      </div>

      {error ? (
        <p role="alert" className="text-sm leading-6 text-red-600">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={working}
        className="inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-periwinkle px-6 text-base font-semibold text-white shadow-lift hover:bg-periwinkle-deep disabled:cursor-not-allowed disabled:opacity-60"
      >
        {working ? "One moment…" : "Update password"}
      </button>
    </form>
  );
}
