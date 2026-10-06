"use client";

import { useEffect, useRef, useState } from "react";

import { useDialogA11y } from "@/lib/a11y/useDialog";
import {
  authCallbackUrl,
  authErrorCopy,
  confirmationReturnPath,
  COPY,
  MIN_PASSWORD_LENGTH,
  PASSWORD_HINT,
  shortPasswordFlow,
  signInWithPasswordFlow,
  signUpOrSignInFlow,
} from "@/components/auth/auth-flow";
import { authConfigured, createAuthBrowserClient } from "@/lib/supabase/auth-browser";
import { X } from "lucide-react";

type Mode = "signIn" | "signUp" | "forgotPassword";

/**
 * The account, asked for at the one moment it is worth something.
 *
 * By the time this appears the customer has read the opening of their own
 * pet's book and wants the rest, so the trade is legible: an address they
 * already gave us and a password, in exchange for the whole book, kept
 * somewhere that is not one browser tab.
 *
 * One password field, no confirmation field, no name — every extra box here is
 * a person who does not finish. The address is prefilled from the one they
 * gave before uploading, and is theirs to correct.
 *
 * Mounted only while open, so every visit starts from a clean state.
 *
 * `initialMode` is which form it opens on. A button that says "Sign in" should
 * open the sign-in form, not one titled "Open the whole book".
 *
 * `returnPath` is where a confirmation email should bring them back to, for a
 * caller that is not the editor: a saved book's own page, say. Left out, the
 * link returns to the editor on the book for this address.
 */
export function AuthGate({
  initialEmail,
  initialMode = "signup",
  returnPath,
  onClose,
  onAuthenticated,
}: {
  initialEmail?: string | null;
  initialMode?: "signup" | "signin";
  returnPath?: string | null;
  onClose: () => void;
  onAuthenticated: () => void;
}) {
  const [mode, setMode] = useState<Mode>(initialMode === "signin" ? "signIn" : "signUp");
  const [email, setEmail] = useState(initialEmail?.trim() ?? "");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "working">("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const backToSignInRef = useRef<HTMLButtonElement>(null);

  // With the address already known, the only thing left to type is the
  // password — so that is where the cursor goes.
  useDialogA11y(dialogRef, {
    onClose,
    initialFocusRef: initialEmail?.trim() ? passwordRef : emailRef,
  });

  // The form, and the button that had focus, are gone once the link is sent.
  // Focus goes to the one control left rather than falling back to the page.
  useEffect(() => {
    if (resetSent) backToSignInRef.current?.focus();
  }, [resetSent]);

  const switchMode = (next: Mode): void => {
    setMode(next);
    setMessage(null);
    setIsError(false);
    setResetSent(false);
  };

  const submitForgotPassword = async (): Promise<void> => {
    const trimmed = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setIsError(true);
      setMessage("Please enter a valid email address.");
      return;
    }
    if (!authConfigured()) {
      setIsError(true);
      setMessage("Accounts are not available right now. Please try again later.");
      return;
    }

    setStatus("working");
    setIsError(false);
    setMessage(null);

    try {
      const supabase = createAuthBrowserClient();
      const { error } = await supabase.auth.resetPasswordForEmail(trimmed, {
        redirectTo: authCallbackUrl(window.location.origin, "/reset-password"),
      });
      setStatus("idle");
      if (error) {
        setIsError(true);
        setMessage(authErrorCopy(error));
        return;
      }
      setResetSent(true);
    } catch (error) {
      setStatus("idle");
      setIsError(true);
      setMessage(authErrorCopy(error));
    }
  };

  const submit = async (): Promise<void> => {
    if (mode === "forgotPassword") {
      await submitForgotPassword();
      return;
    }

    const trimmed = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setIsError(true);
      setMessage("Please enter a valid email address.");
      return;
    }
    // Only a new password is held to the minimum. Someone signing in may
    // have chosen theirs when the minimum was shorter, and must still get in.
    // That includes someone who is signing in on the sign-up form, which is
    // the one this opens on, so a short password is tried as theirs below.
    const tooShort = mode === "signUp" && password.length < MIN_PASSWORD_LENGTH;
    if (tooShort && (password.length === 0 || !authConfigured())) {
      setIsError(true);
      setMessage(COPY.shortPasswordOrSignIn);
      return;
    }
    if (mode === "signIn" && password.length === 0) {
      setIsError(true);
      setMessage("Please enter your password.");
      return;
    }
    if (!authConfigured()) {
      setIsError(true);
      setMessage("Accounts are not available right now. Please try again later.");
      return;
    }

    setStatus("working");
    setIsError(false);
    setMessage(null);

    try {
      const supabase = createAuthBrowserClient();
      const credentials = {
        email: trimmed,
        password,
        // A confirmation link has to come back with a session to the page
        // that asked for it: the one the caller named, or else this book in
        // the editor. Not the front page with nothing.
        emailRedirectTo: authCallbackUrl(
          window.location.origin,
          confirmationReturnPath({
            origin: window.location.origin,
            returnPath,
            email:
              new URLSearchParams(window.location.search).get("email") ||
              initialEmail ||
              null,
          }),
        ),
      };

      // Someone who made a book here before and signs up again with the same
      // address meant "let me in", so the sign-up falls through to a sign-in
      // rather than making them read an error and press a different button.
      const result =
        mode === "signIn"
          ? await signInWithPasswordFlow(supabase.auth, credentials)
          : tooShort
            ? await shortPasswordFlow(supabase.auth, credentials)
            : await signUpOrSignInFlow(supabase.auth, credentials);

      if (result.status === "signedIn") {
        onAuthenticated();
        return;
      }

      setStatus("idle");
      if (result.status === "confirmEmail" || result.status === "confirmationResent") {
        // Only happens when the Supabase project requires email confirmation.
        // Say exactly what is happening instead of appearing to succeed.
        setIsError(false);
        setMessage(
          result.status === "confirmationResent"
            ? COPY.confirmationResent
            : COPY.confirmEmail,
        );
        setMode("signIn");
        return;
      }
      setIsError(true);
      if (result.status === "existingAccountWrongPassword") {
        setMode("signIn");
        setMessage(COPY.existingAccountWrongPassword);
        return;
      }
      if (result.status === "confirmOrWrongPassword") {
        setMode("signIn");
        setMessage(COPY.confirmOrWrongPassword);
        return;
      }
      setMessage(result.message);
    } catch (error) {
      setStatus("idle");
      setIsError(true);
      setMessage(authErrorCopy(error));
    }
  };

  const working = status === "working";

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="authGateTitle"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      {/* Pointer-only dismissal — the form's own controls and Escape cover
          the rest, so this is not also announced as "Close". */}
      <div
        aria-hidden="true"
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-ink/40 backdrop-blur-sm"
      />

      <div className="relative w-full max-w-md rounded-2xl border border-line bg-white p-6 shadow-book">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-2 top-2 inline-flex size-11 items-center justify-center rounded-full text-ink-soft hover:bg-ink/5 hover:text-ink"
        >
          <X aria-hidden className="size-5" />
        </button>
        <h2 id="authGateTitle" className="pr-10 font-display text-2xl text-ink">
          {mode === "signUp"
            ? "Open the whole book"
            : mode === "forgotPassword"
              ? "Reset your password"
              : "Welcome back"}
        </h2>
        {mode === "forgotPassword" && resetSent ? (
          <p
            id="authGateResetSent"
            role="status"
            className="mt-2 text-sm leading-6 text-ink-soft"
          >
            Check your inbox for a link to pick a new one.
          </p>
        ) : (
          <p className="mt-2 text-sm leading-6 text-ink-soft">
            {mode === "signUp"
              ? "Pick a password and every page opens. Your book is saved to your library, where you can change any of it."
              : mode === "forgotPassword"
                ? "We'll email you a link to pick a new one."
                : "Sign in and your book opens where you left it."}
          </p>
        )}

        {mode === "forgotPassword" && resetSent ? (
          <button
            ref={backToSignInRef}
            type="button"
            aria-describedby="authGateResetSent"
            onClick={() => switchMode("signIn")}
            className="mt-6 inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-periwinkle px-5 py-3 text-sm font-semibold text-white shadow-lift hover:bg-periwinkle-deep"
          >
            Back to sign in
          </button>
        ) : (
          <form
            className="mt-5 space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              void submit();
            }}
          >
            <div>
              <label htmlFor="authEmail" className="block text-sm font-medium text-ink">
                Email
              </label>
              <input
                id="authEmail"
                ref={emailRef}
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                disabled={working}
                className="mt-1 min-h-11 w-full rounded-xl border border-line px-3 text-base text-ink outline-none focus:border-periwinkle disabled:opacity-60"
              />
            </div>

            {mode === "forgotPassword" ? null : (
              <div>
                <div className="flex items-baseline justify-between gap-2">
                  <label htmlFor="authPassword" className="block text-sm font-medium text-ink">
                    {mode === "signUp" ? "Choose a password" : "Password"}
                  </label>
                  {mode === "signIn" ? (
                    <button
                      type="button"
                      onClick={() => switchMode("forgotPassword")}
                      className="text-xs text-periwinkle underline underline-offset-4 hover:text-periwinkle-deep"
                    >
                      Forgot password?
                    </button>
                  ) : null}
                </div>
                <input
                  id="authPassword"
                  ref={passwordRef}
                  type="password"
                  autoComplete={mode === "signUp" ? "new-password" : "current-password"}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  disabled={working}
                  className="mt-1 min-h-11 w-full rounded-xl border border-line px-3 text-base text-ink outline-none focus:border-periwinkle disabled:opacity-60"
                />
                {mode === "signUp" ? (
                  <p className="mt-1.5 text-xs text-ink-faint">{PASSWORD_HINT}</p>
                ) : null}
              </div>
            )}

            {message && (
              <p
                role={isError ? "alert" : "status"}
                className={`text-sm leading-6 ${isError ? "text-red-600" : "text-ink-soft"}`}
              >
                {message}
              </p>
            )}

            <button
              type="submit"
              disabled={working}
              className="inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-periwinkle px-5 py-3 text-sm font-semibold text-white shadow-lift hover:bg-periwinkle-deep disabled:cursor-not-allowed disabled:opacity-60"
            >
              {working
                ? "One moment…"
                : mode === "signUp"
                  ? "Open my book"
                  : mode === "forgotPassword"
                    ? "Send reset link"
                    : "Sign in"}
            </button>
          </form>
        )}

        {mode === "forgotPassword" ? (
          resetSent ? null : (
            <button
              type="button"
              onClick={() => switchMode("signIn")}
              className="mt-4 text-sm text-periwinkle underline underline-offset-4 hover:text-periwinkle-deep"
            >
              Back to sign in
            </button>
          )
        ) : (
          <button
            type="button"
            onClick={() => switchMode(mode === "signUp" ? "signIn" : "signUp")}
            className="mt-4 text-sm text-periwinkle underline underline-offset-4 hover:text-periwinkle-deep"
          >
            {mode === "signUp"
              ? "I already have an account"
              : "I need to make an account"}
          </button>
        )}
      </div>
    </div>
  );
}
