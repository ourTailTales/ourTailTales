"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { X } from "lucide-react";

import {
  authConfigured,
  createAuthBrowserClient,
} from "@/lib/supabase/auth-browser";

export type ProtectedBookAction = "preview" | "pdf";

export function BookAuthGate({
  action,
  onClose,
  onAuthenticated,
}: {
  action: ProtectedBookAction;
  onClose: () => void;
  onAuthenticated: () => void;
}) {
  const [mode, setMode] = useState<"signup" | "signin">("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    panelRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const supabase = createAuthBrowserClient();
      const returnPath = window.location.pathname === "/" ? "/" : "/create";
      if (mode === "signin") {
        const { error: authError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (authError) throw authError;
        onAuthenticated();
        return;
      }

      const { data, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(returnPath)}`,
        },
      });
      if (authError) throw authError;
      if (data.session) onAuthenticated();
      else setMessage("Check your email to confirm your account and open your book.");
    } catch (authError) {
      setError(
        authError instanceof Error
          ? authError.message
          : "Account access failed. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  };

  const continueWithGoogle = async () => {
    setBusy(true);
    setError(null);
    try {
      sessionStorage.setItem("ourtailtales.pendingBookAction", action);
      const supabase = createAuthBrowserClient();
      const returnPath = window.location.pathname === "/" ? "/" : "/create";
      const { error: authError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(returnPath)}`,
        },
      });
      if (authError) throw authError;
    } catch (authError) {
      setBusy(false);
      setError(
        authError instanceof Error
          ? authError.message
          : "Google sign-in could not start.",
      );
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-5 py-8" role="dialog" aria-modal="true" aria-labelledby="book-auth-title">
      <button className="absolute inset-0 bg-page-ink/55 backdrop-blur-sm" aria-label="Close account dialog" onClick={onClose} />
      <div ref={panelRef} tabIndex={-1} className="relative w-full max-w-md rounded-[1.5rem] bg-white p-6 text-page-ink shadow-2xl outline-none sm:p-8">
        <button type="button" onClick={onClose} className="absolute right-4 top-4 flex size-9 items-center justify-center rounded-full text-page-ink-soft hover:bg-page-line/50" aria-label="Close">
          <X aria-hidden className="size-4" />
        </button>
        <p className="text-xs font-semibold tracking-[0.16em] text-periwinkle uppercase">Your book is ready</p>
        <h2 id="book-auth-title" className="mt-2 pr-8 font-display text-3xl font-bold">
          Save it before you {action === "pdf" ? "open the PDF" : "turn the pages"}.
        </h2>
        <p className="mt-2 text-sm leading-6 text-page-ink-soft">
          Create a free account so this preview belongs to you and remains private.
        </p>

        {!authConfigured() ? (
          <p className="mt-6 rounded-xl border border-petal bg-petal/25 px-4 py-3 text-sm">
            Account sign-in is not configured yet. Add the Supabase publishable key and provider settings before launch.
          </p>
        ) : (
          <>
            <button type="button" disabled={busy} onClick={() => void continueWithGoogle()} className="mt-6 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-page-line bg-white px-4 py-3 text-sm font-semibold shadow-sm hover:border-periwinkle disabled:opacity-50">
              <span aria-hidden className="font-bold text-[#4285f4]">G</span>
              Continue with Google
            </button>
            <div className="my-5 flex items-center gap-3 text-xs text-page-ink-faint before:h-px before:flex-1 before:bg-page-line after:h-px after:flex-1 after:bg-page-line">or</div>
            <form onSubmit={(event) => void submit(event)} className="space-y-4">
              <label className="block text-sm font-semibold">
                Email
                <input type="email" required autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} className="mt-2 w-full rounded-xl border border-page-line px-4 py-3 font-normal outline-none focus:border-periwinkle focus:ring-2 focus:ring-periwinkle/20" />
              </label>
              <label className="block text-sm font-semibold">
                Password
                <input type="password" required minLength={8} autoComplete={mode === "signup" ? "new-password" : "current-password"} value={password} onChange={(event) => setPassword(event.target.value)} className="mt-2 w-full rounded-xl border border-page-line px-4 py-3 font-normal outline-none focus:border-periwinkle focus:ring-2 focus:ring-periwinkle/20" />
              </label>
              {error ? <p role="alert" className="text-sm text-red-700">{error}</p> : null}
              {message ? <p role="status" className="rounded-xl bg-sage/30 px-4 py-3 text-sm">{message}</p> : null}
              <button type="submit" disabled={busy} className="min-h-12 w-full rounded-xl bg-periwinkle px-5 py-3 text-sm font-semibold text-white shadow-lift hover:bg-periwinkle-deep disabled:opacity-50">
                {busy ? "Please wait…" : mode === "signup" ? "Create free account" : "Sign in"}
              </button>
            </form>
            <button type="button" onClick={() => { setMode(mode === "signup" ? "signin" : "signup"); setError(null); setMessage(null); }} className="mt-4 w-full text-center text-sm font-semibold text-periwinkle hover:text-periwinkle-deep">
              {mode === "signup" ? "Already have an account? Sign in" : "New here? Create an account"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
