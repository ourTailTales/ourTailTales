"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { authConfigured, createAuthBrowserClient } from "@/lib/supabase/auth-browser";

/**
 * Password, and nothing else.
 *
 * The address came with the link, so the only thing left to ask for is the
 * password. It stays editable in case the book was forwarded or the customer
 * would rather use a different address.
 */
export function ClaimForm({ knownEmail }: { knownEmail: string | null }) {
  const router = useRouter();
  const [email, setEmail] = useState(knownEmail ?? "");
  const [password, setPassword] = useState("");
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Set only for the one error this actually explains: an existing account
  // with a password that didn't match. Wrong-address typos and other errors
  // get no such offer, since a reset link would just go to the wrong inbox.
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  const submit = async (): Promise<void> => {
    const trimmed = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setError("Please enter a valid email address.");
      return;
    }
    if (password.length < 6) {
      setError("Passwords need at least 6 characters.");
      return;
    }
    if (!authConfigured()) {
      setError("Accounts are not available right now. Please try again later.");
      return;
    }

    setWorking(true);
    setError(null);
    setShowForgotPassword(false);
    setResetSent(false);
    try {
      const supabase = createAuthBrowserClient();
      let { data, error: authError } = await supabase.auth.signUp({
        email: trimmed,
        password,
      });

      // They have been here before. Treat it as signing in rather than as a
      // wall — they followed a link to their own book, not to a form.
      if (authError && /already registered|already exists|user already/i.test(authError.message)) {
        ({ data, error: authError } = await supabase.auth.signInWithPassword({
          email: trimmed,
          password,
        }));
        if (authError) {
          setWorking(false);
          setError(
            "You already have an account with this address. That password did not match it.",
          );
          setShowForgotPassword(true);
          return;
        }
      }

      if (authError) {
        setWorking(false);
        setError(authError.message);
        return;
      }

      if (!data.session) {
        setWorking(false);
        setError(
          "Check your email to confirm the address, then come back.",
        );
        return;
      }

      // Back to the book. In this browser the album is still in local storage
      // and everything unlocks on arrival; from another device they land on
      // the start of a new book, with this one safe in their library.
      router.push("/create");
      router.refresh();
    } catch (caught) {
      setWorking(false);
      setError(
        caught instanceof Error ? caught.message : "That did not work. Please try again.",
      );
    }
  };

  const sendResetLink = async (): Promise<void> => {
    const trimmed = email.trim();
    if (!authConfigured()) return;

    setWorking(true);
    try {
      const supabase = createAuthBrowserClient();
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(trimmed, {
        redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
      });
      setWorking(false);
      if (resetError) {
        setError(resetError.message);
        return;
      }
      setError(null);
      setShowForgotPassword(false);
      setResetSent(true);
    } catch (caught) {
      setWorking(false);
      setError(
        caught instanceof Error ? caught.message : "That did not work. Please try again.",
      );
    }
  };

  return (
    <form
      className="mt-6 space-y-3"
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <div>
        <label htmlFor="claimEmail" className="block text-sm font-medium text-page-ink">
          Email
        </label>
        <input
          id="claimEmail"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(event) => {
            setEmail(event.target.value);
            setShowForgotPassword(false);
            setResetSent(false);
          }}
          disabled={working}
          className="mt-1 min-h-11 w-full rounded-xl border border-page-line px-3 text-sm text-page-ink outline-none focus:border-periwinkle disabled:opacity-60"
        />
      </div>

      <div>
        <label htmlFor="claimPassword" className="block text-sm font-medium text-page-ink">
          Choose a password
        </label>
        <input
          id="claimPassword"
          type="password"
          autoComplete="new-password"
          autoFocus={Boolean(knownEmail)}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          disabled={working}
          className="mt-1 min-h-11 w-full rounded-xl border border-page-line px-3 text-sm text-page-ink outline-none focus:border-periwinkle disabled:opacity-60"
        />
        <p className="mt-1.5 text-xs text-page-ink-faint">At least 6 characters.</p>
      </div>

      {resetSent ? (
        <p role="status" className="text-sm leading-6 text-page-ink-soft">
          Check your email for a link to pick a new password.
        </p>
      ) : error ? (
        <p role="alert" className="text-sm leading-6 text-red-600">
          {error}{" "}
          {showForgotPassword ? (
            <button
              type="button"
              onClick={() => void sendResetLink()}
              disabled={working}
              className="underline underline-offset-4 hover:text-red-700 disabled:opacity-60"
            >
              Forgot your password?
            </button>
          ) : null}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={working}
        className="inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-periwinkle px-6 text-base font-semibold text-white shadow-lift hover:bg-periwinkle-deep disabled:cursor-not-allowed disabled:opacity-60"
      >
        {working ? "One moment…" : "Open my book"}
      </button>
    </form>
  );
}
