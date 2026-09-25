"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { identifyLead, track } from "@/lib/analytics";
import { useIsAuthenticated } from "@/hooks/useIsAuthenticated";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;


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
  /** Flex-basis/grow class for the input, relative to the button. Defaults to "flex-[2]". */
  inputWidthClassName?: string;
  /**
   * Keep the email field even for a visitor who is already signed in.
   *
   * The hero is the one place this is true. It is the first thing anybody sees,
   * and the offer it makes — hand over an address, get a story back — is the
   * whole pitch of the page; swapping it for a shortcut button means a signed-in
   * visitor, and anybody sharing a browser with one, is shown a different
   * landing page from the one being advertised. The CTAs further down the page
   * come after the pitch has been made, so there the shortcut is a kindness.
   */
  alwaysAskEmail?: boolean;
}

/**
 * Shared email-capture CTA: an auth-aware button that goes straight to /create
 * for signed-in users, or an email input + submit button that captures the
 * lead and redirects to /create. Used on the landing page hero and in the
 * "How it works" section so both stay visually and behaviorally in sync.
 *
 * `alwaysAskEmail` opts out of the auth-aware half of that, and the hero does.
 */
export function EmailCaptureCta({
  source,
  inputId,
  buttonLabel,
  theme = "light",
  className = "",
  inputWidthClassName = "flex-[2]",
}: EmailCaptureCtaProps) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "working" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const isValidEmail = EMAIL_RE.test(email.trim());

  const handleSubmit = () => {
    if (!isValidEmail) {
      setStatus("error");
      setError("Please enter a valid email.");
      return;
    }
    setStatus("working");
    setError(null);
    const trimmedEmail = email.trim();
    identifyLead(trimmedEmail);
    track("lead_captured", { source });
    router.push(`/create?email=${encodeURIComponent(trimmedEmail)}`);
    setStatus("idle");
  };

  const isDark = theme === "dark";

  const inputClassName = isDark
    ? `min-w-0 w-full grow-1 ${inputWidthClassName} rounded-2xl border-2 border-white/40 bg-white px-7 py-6 text-xl text-page-ink placeholder:text-page-ink-faint outline-none transition-colors focus:border-periwinkle focus:ring-2 focus:ring-periwinkle/30`
    : `min-w-0 w-full grow-1 ${inputWidthClassName} rounded-2xl border-2 border-page-line bg-white px-7 py-6 text-xl text-page-ink placeholder:text-page-ink-faint outline-none transition-colors focus:border-periwinkle focus:bg-white focus:ring-2 focus:ring-periwinkle/30`;

  const buttonTextClassName = "text-white";
  const errorClassName = isDark ? "text-lg text-red-400" : "text-lg text-red-500";

  return (
    <div className={`flex w-full max-w-3xl flex-col gap-2 ${className}`}>
      <div className={`flex w-full max-w-3xl flex-col gap-4 sm:flex-row`}>
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
          disabled={status === "working"}
          className={`group inline-flex shrink-0 items-center justify-center gap-3 rounded-2xl bg-periwinkle px-10 py-6 text-xl font-semibold shadow-lift transition-[background-color,transform,opacity] duration-300 hover:enabled:bg-periwinkle-deep hover:enabled:translate-y-px disabled:cursor-not-allowed disabled:opacity-40 ${buttonTextClassName}`}
        >
          {status === "working" ? "Starting…" : buttonLabel}
        </button>
      </div>
      {error && <p className={errorClassName}>{error}</p>}
    </div>
  );
}
