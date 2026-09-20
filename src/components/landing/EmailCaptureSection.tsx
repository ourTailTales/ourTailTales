"use client";

import { useState } from "react";

import { identifyLead, track } from "@/lib/analytics";

export function EmailCaptureSection() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "working" | "done" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  const handleSubmit = async (): Promise<void> => {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setStatus("error");
      setMessage("Please enter a valid email address.");
      return;
    }

    setStatus("working");
    setMessage(null);

    try {
      identifyLead(email.trim());
      track("lead_captured", { source: "landing_email_capture" });
      // Redirect to the create flow after a brief moment so they see confirmation
      setStatus("done");
      setMessage("Great! Taking you to build your free story…");
      setTimeout(() => {
        window.location.href = "/create";
      }, 1200);
    } catch {
      setStatus("error");
      setMessage("Something went wrong. Please try again.");
    }
  };

  return (
    <section
      id="email-capture"
      aria-labelledby="capture-heading"
      className="w-full bg-lavender/40"
    >
      <div className="mx-auto max-w-2xl px-5 py-16 text-center sm:px-8 sm:py-20">
        <p className="text-sm font-semibold uppercase tracking-widest text-periwinkle">
          Free, no credit card
        </p>
        <h2
          id="capture-heading"
          className="mt-2 font-display text-3xl font-bold text-ink sm:text-4xl"
        >
          Claim Your Free Pet Story PDF
        </h2>
        <p className="mt-3 text-base leading-7 text-ink-soft">
          Right now their photos are scattered across the camera roll, doing nothing.
          Drop them here. We organize the memories, write the chapters, and hand you
          a full PDF story. Free. In minutes.
        </p>

        <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <label htmlFor="capture-email" className="sr-only">
            Email address
          </label>
          <input
            id="capture-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") void handleSubmit(); }}
            placeholder="your@email.com"
            autoComplete="email"
            disabled={status === "working" || status === "done"}
            className="w-full max-w-xs rounded-xl border border-line bg-white px-4 py-3 text-ink outline-none transition-colors placeholder:text-ink-faint focus:border-periwinkle focus:ring-2 focus:ring-periwinkle/20 sm:w-72"
          />
          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={status === "working" || status === "done"}
            className="w-full max-w-xs rounded-xl bg-periwinkle px-6 py-3 text-sm font-semibold text-white shadow-lift transition-colors hover:bg-periwinkle-deep disabled:opacity-60 sm:w-auto"
          >
            {status === "working" ? "One sec…" : status === "done" ? "On the way! →" : "Send Me the Free PDF →"}
          </button>
        </div>

        {message && (
          <p
            role="status"
            className={`mt-4 text-sm ${status === "error" ? "text-red-600" : "text-sage-deep"}`}
          >
            {message}
          </p>
        )}

        <p className="mt-4 text-xs text-ink-faint">
          No credit card. Your photos stay on your device until you choose to order.
        </p>
      </div>
    </section>
  );
}
