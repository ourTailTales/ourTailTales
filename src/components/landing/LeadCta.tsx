"use client";

import { useEffect, useState } from "react";
import { authConfigured, createAuthBrowserClient } from "@/lib/supabase/auth-browser";
import { identifyLead, track } from "@/lib/analytics";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const externalLinkIcon = (
  <svg
    aria-hidden
    className="h-4 w-4 transition-transform duration-300 group-hover:group-enabled:translate-x-0.5"
    viewBox="0 0 20 20"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M11 3h6v6" />
    <path d="M17 3l-8 8" />
    <path d="M9 5H5a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2v-4" />
  </svg>
);

interface LeadCtaProps {
  source: string;
  inputId: string;
  /** Extra classes on the outer wrapper div */
  className?: string;
  /** Tailwind classes for the email input */
  inputClassName?: string;
}

export function LeadCta({ source, inputId, className = "", inputClassName }: LeadCtaProps) {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "working" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authConfigured()) { setAuthed(false); return; }
    const client = createAuthBrowserClient();
    client.auth.getSession().then(({ data }) => {
      setAuthed(!!data.session);
    });
    const { data: { subscription } } = client.auth.onAuthStateChange((_e, session) => {
      setAuthed(!!session);
    });
    return () => subscription.unsubscribe();
  }, []);

  const isValidEmail = EMAIL_RE.test(email.trim());

  const handleSubmit = async () => {
    if (!isValidEmail) {
      setStatus("error");
      setError("Please enter a valid email.");
      return;
    }
    setStatus("working");
    setError(null);
    identifyLead(email.trim());
    track("lead_captured", { source });
    window.location.href = "/create";
  };

  // If authed: single button straight to /create
  if (authed === true) {
    return (
      <div className={className}>
        <a
          href="/create"
          className="group inline-flex items-center justify-center gap-2 rounded-xl bg-periwinkle px-6 py-3 text-sm font-semibold text-white shadow-lift transition-[background-color,transform] duration-300 hover:bg-periwinkle-deep hover:translate-y-px"
        >
          Create your Book
          {externalLinkIcon}
        </a>
      </div>
    );
  }

  // Default: email capture form (also renders while auth state loads)
  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      <div className="flex w-full max-w-md flex-col gap-2 sm:flex-row">
        <label htmlFor={inputId} className="sr-only">Email address</label>
        <input
          id={inputId}
          type="email"
          value={email}
          onChange={(e) => { setEmail(e.target.value); setStatus("idle"); setError(null); }}
          onKeyDown={(e) => { if (e.key === "Enter") void handleSubmit(); }}
          placeholder="your@email.com"
          autoComplete="email"
          disabled={status === "working"}
          className={inputClassName ?? "flex-1 rounded-xl border border-page-line bg-white px-4 py-3 text-sm text-page-ink placeholder:text-page-ink-faint outline-none transition-colors focus:border-periwinkle focus:bg-white focus:ring-2 focus:ring-periwinkle/30"}
        />
        <button
          type="button"
          onClick={() => void handleSubmit()}
          disabled={status === "working" || !isValidEmail}
          className="group inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-periwinkle px-6 py-3 text-sm font-semibold text-white shadow-lift transition-[background-color,transform] duration-300 hover:enabled:bg-periwinkle-deep hover:enabled:translate-y-px disabled:cursor-not-allowed disabled:opacity-40"
        >
          {status === "working" ? "Opening…" : "Get Their Free Story PDF"}
          {status !== "working" && externalLinkIcon}
        </button>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
