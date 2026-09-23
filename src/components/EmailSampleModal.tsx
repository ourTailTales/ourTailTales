"use client";

import { useEffect, useRef, useState } from "react";

/** Mounted only while open, so each visit starts from a clean state. */
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
  const [status, setStatus] = useState<"idle" | "working" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const handleSubmit = async (): Promise<void> => {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setStatus("error");
      setMessage("Please enter a valid email address.");
      return;
    }

    setStatus("working");
    setMessage("Sending your first pages…");
    try {
      await onSubmit(email.trim());
      setMessage("On its way. Check your inbox.");
      setStatus("idle");
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
      role="dialog"
      aria-modal="true"
      aria-labelledby="sampleTitle"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      <button
        type="button"
        aria-label="Close"
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
            onChange={(event) => setEmail(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") void handleSubmit();
            }}
            placeholder="you@example.com"
            autoComplete="email"
            className="w-full rounded-lg border border-line bg-white px-3.5 py-2.5 text-ink outline-none transition-colors placeholder:text-ink-faint focus:border-periwinkle focus:ring-2 focus:ring-periwinkle/20"
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

        <div className="mt-6 flex items-center gap-3">
          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={status === "working"}
            className="rounded-xl bg-periwinkle px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-periwinkle-deep disabled:opacity-60"
          >
            {status === "working" ? "Building…" : "Send my sample"}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="text-sm text-ink-soft underline decoration-line underline-offset-4 hover:text-periwinkle-deep"
          >
            Not now
          </button>
        </div>
      </div>
    </div>
  );
}
