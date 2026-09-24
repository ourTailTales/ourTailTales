"use client";

import { useRef, useState } from "react";

import { useDialogA11y } from "@/lib/a11y/useDialog";

/**
 * Mounted only while open, so each visit starts from a clean state.
 *
 * Opening this already was the request — the customer clicked "Email me my
 * book" — so the only thing missing is an address, not a second decision
 * about whether to send it. There is no separate "send" button: a valid
 * address sends the moment it's given, the same way the address field during
 * upload commits itself on blur rather than waiting for a submit click.
 */
export function EmailSampleModal({
  onClose,
  onSubmit,
  initialEmail,
}: {
  onClose: () => void;
  onSubmit: (email: string) => Promise<void>;
  initialEmail: string | null;
}) {
  const [email, setEmail] = useState(initialEmail ?? "");
  const [status, setStatus] = useState<"idle" | "working" | "sent" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  useDialogA11y(dialogRef, { onClose, initialFocusRef: inputRef });

  const isValid = (value: string): boolean =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

  const send = async (): Promise<void> => {
    // Already sent, or already sending — a blur right after Enter must not
    // fire this twice.
    if (status === "working" || status === "sent") return;
    if (!isValid(email)) {
      setStatus("error");
      setMessage("Please enter a valid email address.");
      return;
    }

    setStatus("working");
    setMessage("Sending your first pages…");
    try {
      await onSubmit(email.trim());
      setStatus("sent");
      setMessage("On its way. Check your inbox.");
    } catch (error) {
      setStatus("error");
      setMessage(
        error instanceof Error
          ? error.message
          : "The sample could not be built. Please try again.",
      );
    }
  };

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="sampleTitle"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      {/* Pointer-only dismissal. Not a button: the panel's own Close button
          and Escape already cover keyboard and screen-reader users, and a
          second control named "Close" only doubled the announcement. */}
      <div
        aria-hidden="true"
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-ink/40 backdrop-blur-sm"
      />

      <div className="relative w-full max-w-md rounded-2xl border border-line bg-white p-6 shadow-book">
        <h2 id="sampleTitle" className="font-display text-2xl text-ink">
          Where should we send it?
        </h2>
        <p className="mt-2 text-sm leading-6 text-ink-soft">
          We&rsquo;ll email you the first ten pages of your book as a PDF,
          cover included, plus the link that opens the rest.
        </p>

        <label className="mt-5 block">
          <span className="mb-1.5 block text-sm font-medium text-ink-soft">
            Email address
          </span>
          <input
            ref={inputRef}
            type="email"
            value={email}
            disabled={status === "working" || status === "sent"}
            onChange={(event) => {
              setEmail(event.target.value);
              if (status === "error") {
                setStatus("idle");
                setMessage(null);
              }
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") void send();
            }}
            onBlur={() => {
              if (isValid(email)) void send();
            }}
            placeholder="you@example.com"
            autoComplete="email"
            className="w-full rounded-lg border border-line bg-white px-3.5 py-2.5 text-ink outline-none transition-colors placeholder:text-ink-faint focus:border-periwinkle focus:ring-2 focus:ring-periwinkle/20 disabled:opacity-60"
          />
        </label>

        <p className="mt-2 text-xs text-ink-faint">
          We use your address to send your book and order updates. Your photos
          never leave your device. Only the finished PDF is stored.
        </p>

        {message && (
          <p
            role="status"
            className={`mt-4 text-sm ${status === "error" ? "text-periwinkle-deep" : "text-sage-deep"}`}
          >
            {message}
          </p>
        )}
      </div>
    </div>
  );
}
