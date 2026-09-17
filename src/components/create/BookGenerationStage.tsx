"use client";

import { Check, LoaderCircle } from "lucide-react";

import { useOurTailTalesStore } from "@/store/useOurTailTalesStore";

export function BookGenerationStage() {
  const meta = useOurTailTalesStore((state) => state.meta);
  const chapters = useOurTailTalesStore((state) => state.chapters);
  const funnelState = useOurTailTalesStore((state) => state.funnelState);
  const storyDone = chapters.filter(
    (chapter) => chapter.aiStatus === "done" || chapter.aiStatus === "error",
  ).length;
  const writing = funnelState === "ai_generating";

  const steps = [
    { label: "Organizing the timeline", done: chapters.length > 0 },
    { label: "Choosing the best moments", done: chapters.length > 0 },
    {
      label: `Writing ${Math.max(chapters.length, 5)} chapters`,
      done: chapters.length > 0 && storyDone === chapters.length,
      detail:
        writing && chapters.length > 0
          ? `${storyDone} of ${chapters.length}`
          : undefined,
    },
    {
      label: "Laying out the pages",
      done: chapters.length > 0 && storyDone === chapters.length,
    },
    { label: "Creating your preview", done: false },
  ];
  const active = Math.max(0, steps.findIndex((step) => !step.done));

  return (
    <section className="quick-create-stage relative flex min-h-[calc(100dvh-5rem)] items-center justify-center overflow-hidden px-5 py-12 sm:px-8">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_25%,rgb(255_255_255/0.72),transparent_38%),linear-gradient(180deg,rgb(228_236_248),rgb(226_215_245/0.84))]" />
      <div className="absolute inset-0 bg-[radial-gradient(rgb(91_104_200/0.14)_1px,transparent_1.2px)] bg-[size:18px_18px]" />

      <div className="relative w-full max-w-lg rounded-[1.75rem] border border-white/80 bg-white/94 p-7 shadow-[0_24px_70px_-24px_rgb(25_32_58/0.5)] backdrop-blur-xl sm:p-9">
        <LoaderCircle
          aria-hidden
          className="mx-auto size-11 animate-spin text-periwinkle"
          strokeWidth={1.6}
        />
        <h1 className="mt-5 text-center font-display text-3xl font-bold text-page-ink sm:text-4xl">
          Building {possessive(meta.petName)} book…
        </h1>
        <p className="mt-2 text-center text-sm leading-6 text-page-ink-soft">
          We’re turning the timeline into a five-chapter story. Keep this tab open.
        </p>

        <ol className="mt-7 space-y-3">
          {steps.map((step, index) => {
            const isActive = index === active;
            return (
              <li
                key={step.label}
                className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-sm transition-colors ${
                  step.done
                    ? "border-sage bg-sage/25 text-page-ink"
                    : isActive
                      ? "border-periwinkle/35 bg-memory-blue/30 text-page-ink"
                      : "border-page-line/70 bg-white/55 text-page-ink-faint"
                }`}
              >
                <span
                  className={`flex size-6 shrink-0 items-center justify-center rounded-full ${
                    step.done
                      ? "bg-sage text-page-ink"
                      : isActive
                        ? "bg-periwinkle text-white"
                        : "bg-page-line/60"
                  }`}
                >
                  {step.done ? (
                    <Check aria-hidden className="size-3.5" strokeWidth={2.5} />
                  ) : isActive ? (
                    <span className="size-2 animate-pulse rounded-full bg-white" />
                  ) : null}
                </span>
                <span className="flex-1">{step.label}</span>
                {step.detail ? (
                  <span className="text-xs font-semibold text-periwinkle">
                    {step.detail}
                  </span>
                ) : null}
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}

function possessive(name: string): string {
  const clean = name.trim();
  if (!clean) return "your pet’s";
  return /s$/i.test(clean) ? `${clean}’` : `${clean}’s`;
}
