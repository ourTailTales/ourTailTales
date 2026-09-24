"use client";

import { useRef, useState } from "react";

import { useDialogA11y } from "@/lib/a11y/useDialog";
import { authConfigured, createAuthBrowserClient } from "@/lib/supabase/auth-browser";

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
 */
export function AuthGate({
  initialEmail,
  onClose,
  onAuthenticated,
}: {
  initialEmail?: string | null;
  onClose: () => void;
  onAuthenticated: () => void;
}) {
  const [mode, setMode] = useState<Mode>("signUp");
  const [email, setEmail] = useState(initialEmail?.trim() ?? "");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "working">("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  // With the address already known, the only thing left to type is the
  // password — so that is where the cursor goes.
  useDialogA11y(dialogRef, {
    onClose,
    initialFocusRef: initialEmail?.trim() ? passwordRef : emailRef,
  });

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
        redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
      });
      setStatus("idle");
      if (error) {
        setIsError(true);
        setMessage(error.message);
        return;
      }
      setResetSent(true);
    } catch (error) {
      setStatus("idle");
      setIsError(true);
      setMessage(
        error instanceof Error ? error.message : "That did not work. Please try again.",
      );
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
    // Supabase's own floor. Saying so here beats a server round-trip to learn it.
    if (password.length < 6) {
      setIsError(true);
      setMessage("Passwords need at least 6 characters.");
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
      const attempt = async (which: Mode) =>
        which === "signIn"
          ? supabase.auth.signInWithPassword({ email: trimmed, password })
          : supabase.auth.signUp({ email: trimmed, password });

      let { data, error } = await attempt(mode);

      // Someone who made a book here before is signing up again with the same
      // address. They meant "let me in", so let them in rather than making
      // them read an error and press a different button.
      if (error && mode === "signUp" && looksRegistered(error.message)) {
        setMode("signIn");
        ({ data, error } = await attempt("signIn"));
        if (error) {
          setStatus("idle");
          setIsError(true);
          setMessage(
            "You already have an account with this address. That password did not match it.",
          );
          return;
        }
      }

      if (error) {
        setStatus("idle");
        setIsError(true);
        setMessage(error.message);
        return;
      }

      // A sign-up returns no session only when the Supabase project requires
      // email confirmation. This product deliberately does not — clicking the
      // link in the book email already proves the address — so if it ever
      // does, say exactly what is happening instead of appearing to succeed.
      if (!data.session) {
        setStatus("idle");
        setIsError(false);
        setMessage(
          "Check your email to confirm the address, then come back and sign in.",
        );
        setMode("signIn");
        return;
      }

      onAuthenticated();
    } catch (error) {
      setStatus("idle");
      setIsError(true);
      setMessage(
        error instanceof Error ? error.message : "That did not work. Please try again.",
      );
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
        <h2 id="authGateTitle" className="font-display text-2xl text-ink">
          {mode === "signUp"
            ? "Open the whole book"
            : mode === "forgotPassword"
              ? "Reset your password"
              : "Welcome back"}
        </h2>
        <p className="mt-2 text-sm leading-6 text-ink-soft">
          {mode === "signUp"
            ? "Pick a password and every page opens. Your book is saved to your library, where you can change any of it."
            : mode === "forgotPassword"
              ? resetSent
                ? "Check your inbox for a link to pick a new one."
                : "We'll email you a link to pick a new one."
              : "Sign in and your book opens where you left it."}
        </p>

        {mode === "forgotPassword" && resetSent ? (
          <button
            type="button"
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
                className="mt-1 min-h-11 w-full rounded-xl border border-line px-3 text-sm text-ink outline-none focus:border-periwinkle disabled:opacity-60"
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
                  className="mt-1 min-h-11 w-full rounded-xl border border-line px-3 text-sm text-ink outline-none focus:border-periwinkle disabled:opacity-60"
                />
                {mode === "signUp" ? (
                  <p className="mt-1.5 text-xs text-ink-faint">At least 6 characters.</p>
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

/** Supabase has worded this several ways across versions. */
function looksRegistered(message: string): boolean {
  return /already registered|already exists|user already/i.test(message);
}
