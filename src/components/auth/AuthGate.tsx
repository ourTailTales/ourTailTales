"use client";

import { useEffect, useRef, useState } from "react";

import { authConfigured, createAuthBrowserClient } from "@/lib/supabase/auth-browser";

type Mode = "signIn" | "signUp";

/**
 * Email/password gate, shown at the moment the customer asks for their PDF.
 *
 * Deliberately the last step rather than the first: someone who has not yet
 * seen their book has no reason to make an account, and asking up front costs
 * more of them than it is worth. By the time this appears they have a finished
 * book on screen and the account is what keeps it.
 *
 * Mounted only while open, so every visit starts from a clean state.
 */
export function AuthGate({
  onClose,
  onAuthenticated,
}: {
  onClose: () => void;
  onAuthenticated: () => void;
}) {
  const [mode, setMode] = useState<Mode>("signUp");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "working">("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);
  const emailRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    emailRef.current?.focus();
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const submit = async (): Promise<void> => {
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
      const { data, error } =
        mode === "signIn"
          ? await supabase.auth.signInWithPassword({ email: trimmed, password })
          : await supabase.auth.signUp({ email: trimmed, password });

      if (error) {
        setStatus("idle");
        setIsError(true);
        setMessage(error.message);
        return;
      }

      // A sign-up returns no session when the project requires email
      // confirmation. The customer cannot finish here, so say exactly that
      // rather than appearing to succeed and then doing nothing.
      if (!data.session) {
        setStatus("idle");
        setIsError(false);
        setMessage(
          "Almost there — check your email to confirm the address, then come back and sign in.",
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
      role="dialog"
      aria-modal="true"
      aria-labelledby="authGateTitle"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-ink/40 backdrop-blur-sm"
      />

      <div className="relative w-full max-w-md rounded-2xl border border-line bg-white p-6 shadow-book">
        <h2 id="authGateTitle" className="font-display text-2xl text-ink">
          {mode === "signUp" ? "Keep your book" : "Welcome back"}
        </h2>
        <p className="mt-2 text-sm leading-6 text-ink-soft">
          {mode === "signUp"
            ? "Your book is ready. Make an account and it stays in your library — open it again from any device, not just this browser."
            : "Sign in and your download will start straight away."}
        </p>

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

          <div>
            <label htmlFor="authPassword" className="block text-sm font-medium text-ink">
              Password
            </label>
            <input
              id="authPassword"
              type="password"
              autoComplete={mode === "signUp" ? "new-password" : "current-password"}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              disabled={working}
              className="mt-1 min-h-11 w-full rounded-xl border border-line px-3 text-sm text-ink outline-none focus:border-periwinkle disabled:opacity-60"
            />
          </div>

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
                ? "Create account and download"
                : "Sign in and download"}
          </button>
        </form>

        <button
          type="button"
          onClick={() => {
            setMode(mode === "signUp" ? "signIn" : "signUp");
            setMessage(null);
            setIsError(false);
          }}
          className="mt-4 text-sm text-periwinkle underline underline-offset-4 hover:text-periwinkle-deep"
        >
          {mode === "signUp"
            ? "I already have an account"
            : "I need to make an account"}
        </button>
      </div>
    </div>
  );
}
