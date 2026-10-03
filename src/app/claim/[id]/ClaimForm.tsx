"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import {
  authCallbackUrl,
  authErrorCopy,
  COPY,
  createPathForEmail,
  MIN_PASSWORD_LENGTH,
  PASSWORD_HINT,
  shortPasswordFlow,
  signInWithPasswordFlow,
  signUpOrSignInFlow,
} from "@/components/auth/auth-flow";
import { authConfigured, createAuthBrowserClient } from "@/lib/supabase/auth-browser";

type Mode = "signUp" | "signIn";

/**
 * Password, and nothing else.
 *
 * The address came with the link, so the only thing left to ask for is the
 * password. It stays editable in case the book was forwarded or the customer
 * would rather use a different address.
 *
 * Someone who already has an account can say so and sign in instead. A sign-up
 * that turns out to be a returning customer is signed in without being asked.
 */
export function ClaimForm({
  knownEmail,
  initialMode = "signup",
}: {
  knownEmail: string | null;
  initialMode?: "signup" | "signin";
}) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>(initialMode === "signin" ? "signIn" : "signUp");
  const [email, setEmail] = useState(knownEmail ?? "");
  const [password, setPassword] = useState("");
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);
  // Set only for the one error this actually explains: an existing account
  // with a password that didn't match. Wrong-address typos and other errors
  // get no such offer, since a reset link would just go to the wrong inbox.
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  const fail = (text: string): void => {
    setIsError(true);
    setMessage(text);
  };

  const switchMode = (next: Mode): void => {
    setMode(next);
    setMessage(null);
    setIsError(false);
    setShowForgotPassword(false);
    setResetSent(false);
  };

  const submit = async (): Promise<void> => {
    const trimmed = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      fail("Please enter a valid email address.");
      return;
    }
    // Only a new password is held to the minimum. Someone signing in may have
    // chosen theirs when the minimum was shorter, and must still get in.
    // That includes someone signing in on the sign-up form, which is the one
    // this opens on, so a short password is tried as theirs below.
    const tooShort = mode === "signUp" && password.length < MIN_PASSWORD_LENGTH;
    if (tooShort && (password.length === 0 || !authConfigured())) {
      fail(COPY.shortPasswordOrSignIn);
      return;
    }
    if (mode === "signIn" && password.length === 0) {
      fail("Please enter your password.");
      return;
    }
    if (!authConfigured()) {
      fail("Accounts are not available right now. Please try again later.");
      return;
    }

    setWorking(true);
    setMessage(null);
    setIsError(false);
    setShowForgotPassword(false);
    setResetSent(false);
    try {
      const supabase = createAuthBrowserClient();
      const credentials = {
        email: trimmed,
        password,
        // If the address has to be confirmed first, the link in that email
        // comes back to this very page, signed in.
        emailRedirectTo: authCallbackUrl(
          window.location.origin,
          `${window.location.pathname}${window.location.search}`,
        ),
      };
      const result =
        mode === "signIn"
          ? await signInWithPasswordFlow(supabase.auth, credentials)
          : tooShort
            ? await shortPasswordFlow(supabase.auth, credentials)
            : await signUpOrSignInFlow(supabase.auth, credentials);

      if (result.status === "signedIn") {
        // Back to the book. The album in this browser is filed under the
        // address the book was made with, so the editor is asked for that
        // address: without it the editor opens an empty book. Arriving there
        // signed in is what saves the book to the account. From another
        // device there is no album to open and they start a new book.
        router.push(createPathForEmail(knownEmail));
        router.refresh();
        return;
      }

      setWorking(false);
      if (result.status === "confirmEmail" || result.status === "confirmationResent") {
        setMode("signIn");
        setIsError(false);
        setMessage(
          result.status === "confirmationResent"
            ? COPY.confirmationResent
            : COPY.confirmEmail,
        );
        return;
      }
      if (
        result.status === "existingAccountWrongPassword" ||
        result.status === "confirmOrWrongPassword"
      ) {
        setMode("signIn");
        fail(
          result.status === "confirmOrWrongPassword"
            ? COPY.confirmOrWrongPassword
            : COPY.existingAccountWrongPassword,
        );
        setShowForgotPassword(true);
        return;
      }
      fail(result.message);
    } catch (caught) {
      setWorking(false);
      fail(authErrorCopy(caught));
    }
  };

  const sendResetLink = async (): Promise<void> => {
    const trimmed = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      fail("Please enter your email address first.");
      return;
    }
    if (!authConfigured()) {
      fail("Accounts are not available right now. Please try again later.");
      return;
    }

    setWorking(true);
    try {
      const supabase = createAuthBrowserClient();
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(trimmed, {
        redirectTo: authCallbackUrl(window.location.origin, "/reset-password"),
      });
      setWorking(false);
      if (resetError) {
        fail(authErrorCopy(resetError));
        return;
      }
      setMessage(null);
      setIsError(false);
      setShowForgotPassword(false);
      setResetSent(true);
    } catch (caught) {
      setWorking(false);
      fail(authErrorCopy(caught));
    }
  };

  const inputClass =
    "mt-1 min-h-11 w-full rounded-xl border border-page-line px-3 text-base text-page-ink outline-none focus:border-periwinkle disabled:opacity-60";

  return (
    <>
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
            className={inputClass}
          />
        </div>

        <div>
          <div className="flex items-baseline justify-between gap-2">
            <label htmlFor="claimPassword" className="block text-sm font-medium text-page-ink">
              {mode === "signUp" ? "Choose a password" : "Password"}
            </label>
            {mode === "signIn" ? (
              <button
                type="button"
                onClick={() => void sendResetLink()}
                disabled={working}
                className="text-xs text-periwinkle underline underline-offset-4 hover:text-periwinkle-deep disabled:opacity-60"
              >
                Forgot password?
              </button>
            ) : null}
          </div>
          <input
            id="claimPassword"
            type="password"
            autoComplete={mode === "signUp" ? "new-password" : "current-password"}
            autoFocus={Boolean(knownEmail)}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            disabled={working}
            className={inputClass}
          />
          {mode === "signUp" ? (
            <p className="mt-1.5 text-xs text-page-ink-faint">{PASSWORD_HINT}</p>
          ) : null}
        </div>

        {resetSent ? (
          <p role="status" className="text-sm leading-6 text-page-ink-soft">
            Check your email for a link to pick a new password.
          </p>
        ) : message ? (
          <p
            role={isError ? "alert" : "status"}
            className={`text-sm leading-6 ${isError ? "text-red-600" : "text-page-ink-soft"}`}
          >
            {message}{" "}
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
          {working ? "One moment…" : mode === "signUp" ? "Open my book" : "Sign in"}
        </button>
      </form>

      <button
        type="button"
        onClick={() => switchMode(mode === "signUp" ? "signIn" : "signUp")}
        disabled={working}
        className="mt-4 text-sm text-periwinkle underline underline-offset-4 hover:text-periwinkle-deep disabled:opacity-60"
      >
        {mode === "signUp" ? "I already have an account" : "I need to make an account"}
      </button>
    </>
  );
}
