"use client";

import { useState } from "react";

import { identifyLead, track } from "@/lib/analytics";
import { useIsAuthenticated } from "@/hooks/useIsAuthenticated";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const externalLinkIcon = (
  <svg
    aria-hidden
    className="h-6 w-6 transition-transform duration-300 group-hover:group-enabled:translate-x-0.5"
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

interface EmailCaptureCtaProps {
  /** Tag sent to analytics on lead capture, identifying where the CTA lives. */
  source: string;
  /** Unique id for the email input (labels must be unique across the page). */
  inputId: string;
  /** Button label while idle (e.g. "Create their Book", "Get Their Free Story PDF"). */
  buttonLabel: string;
  /** Visual theme: "dark" for the hero (over the photo banner), "light" for CTAs on a light background. */
  theme?: "dark" | "light";
  /** Extra classes on the outer wrapper div. */
  className?: string;
  /** Extra classes on the row containing the input + button. */
  rowClassName?: string;
}

/**
 * Shared email-capture CTA: an auth-aware button that goes straight to /create
 * for signed-in users, or an email input + submit button that captures the
 * lead and redirects to /create. Used on the landing page hero and in the
 * "How it works" section so both stay visually and behaviorally in sync.
 */
export function EmailCaptureCta({
  source,
  inputId,
  buttonLabel,
  theme = "light",
  className = "",
  rowClassName = "",
}: EmailCaptureCtaProps) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "working" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const isAuthenticated = useIsAuthenticated();

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

  const isDark = theme === "dark";

  // Auth-aware: signed-in users go straight to /create
  // TODO: useIsAuthenticated() returns false until Supabase session check is implemented
  if (isAuthenticated) {
    return (
      <div className={className}>
        <a
          href="/create"
          className={`inline-flex w-fit items-center gap-3 rounded-2xl bg-periwinkle px-12 py-6 text-xl font-semibold shadow-lift transition-colors hover:bg-periwinkle-deep ${
            isDark ? "text-white" : "text-page-ink"
          }`}
        >
          Create your Book
          {externalLinkIcon}
        </a>
      </div>
    );
  }

  const inputClassName = isDark
    ? "flex-1 rounded-2xl border-2 border-white/40 bg-white px-7 py-6 text-xl text-page-ink placeholder:text-page-ink-faint outline-none transition-colors focus:border-periwinkle focus:ring-2 focus:ring-periwinkle/30"
    : "flex-1 rounded-2xl border-2 border-page-line bg-white px-7 py-6 text-xl text-page-ink placeholder:text-page-ink-faint outline-none transition-colors focus:border-periwinkle focus:bg-white focus:ring-2 focus:ring-periwinkle/30";

  const buttonTextClassName = isDark ? "text-white" : "text-page-ink";
  const errorClassName = isDark ? "text-lg text-red-400" : "text-lg text-red-500";

  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      <div className={`flex w-full max-w-3xl flex-col gap-4 sm:flex-row ${rowClassName}`}>
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
          className={inputClassName}
        />
        <button
          type="button"
          onClick={() => void handleSubmit()}
          disabled={status === "working" || !isValidEmail}
          className={`group inline-flex shrink-0 items-center justify-center gap-3 rounded-2xl bg-periwinkle px-10 py-6 text-xl font-semibold shadow-lift transition-[background-color,transform,opacity] duration-300 hover:enabled:bg-periwinkle-deep hover:enabled:translate-y-px disabled:cursor-not-allowed disabled:opacity-40 ${buttonTextClassName}`}
        >
          {status === "working" ? "Opening…" : buttonLabel}
          {status !== "working" && externalLinkIcon}
        </button>
      </div>
      {error && <p className={errorClassName}>{error}</p>}
    </div>
  );
}
