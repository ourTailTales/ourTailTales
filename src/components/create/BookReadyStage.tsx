"use client";

import { BookOpen, FileText, LockKeyhole } from "lucide-react";
import { useMemo } from "react";

import { photoMapOf, useOurTailTalesStore } from "@/store/useOurTailTalesStore";

export function BookReadyStage({
  onPreview,
  onPdf,
  saving = false,
  notice = null,
}: {
  onPreview: () => void;
  onPdf: () => void;
  saving?: boolean;
  notice?: string | null;
}) {
  const meta = useOurTailTalesStore((state) => state.meta);
  const chapters = useOurTailTalesStore((state) => state.chapters);
  const photos = useOurTailTalesStore((state) => state.photos);
  const photoMap = useMemo(() => photoMapOf(photos), [photos]);
  const coverId = meta.coverPhotoId ?? chapters[0]?.heroPhotoId ?? null;
  const cover = coverId ? photoMap.get(coverId)?.thumbUrl : null;

  return (
    <section className="quick-create-stage relative isolate flex min-h-[calc(100dvh-5rem)] items-center justify-center overflow-hidden px-5 py-12 sm:px-8">
      {cover ? (
        // eslint-disable-next-line @next/next/no-img-element -- local object URL
        <img
          src={cover}
          alt=""
          className="absolute inset-0 -z-20 h-full w-full scale-105 object-cover blur-2xl"
        />
      ) : null}
      <div className="absolute inset-0 -z-10 bg-[linear-gradient(180deg,rgb(228_236_248/0.88),rgb(226_215_245/0.92))]" />

      <div className="grid w-full max-w-3xl items-center gap-8 rounded-[1.75rem] border border-white/80 bg-white/94 p-6 shadow-[0_24px_70px_-24px_rgb(25_32_58/0.52)] backdrop-blur-xl sm:grid-cols-[0.8fr_1.2fr] sm:p-8">
        <div className="mx-auto w-full max-w-56">
          <div className="relative aspect-square overflow-hidden rounded-lg bg-page-ink/10 shadow-book">
            {cover ? (
              // eslint-disable-next-line @next/next/no-img-element -- local object URL
              <img src={cover} alt="" className="h-full w-full object-cover" />
            ) : null}
            <div className="absolute inset-0 bg-gradient-to-t from-page-ink/55 via-transparent to-white/10" />
            <div className="absolute inset-x-4 bottom-4 text-center text-white">
              <p className="font-cover text-2xl font-semibold">
                {meta.petName || "Their Story"}
              </p>
              <p className="mt-1 text-xs tracking-[0.2em] uppercase">
                Their life, in chapters
              </p>
            </div>
          </div>
        </div>

        <div className="text-center sm:text-left">
          <p className="text-xs font-semibold tracking-[0.18em] text-periwinkle uppercase">
            Your free book is ready
          </p>
          <h1 className="mt-2 font-display text-4xl font-bold text-page-ink">
            {possessive(meta.petName)} story is waiting.
          </h1>
          <p className="mt-3 text-sm leading-6 text-page-ink-soft">
            We organized the timeline, selected the moments, and created a complete five-chapter preview.
          </p>

          {notice ? (
            <p role="alert" className="mt-4 rounded-xl border border-petal bg-petal/25 px-4 py-3 text-sm text-page-ink">
              {notice}
            </p>
          ) : null}

          <div className="mt-6 grid gap-3">
            <button
              type="button"
              onClick={onPreview}
              disabled={saving}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-periwinkle px-5 py-3 text-sm font-semibold text-white shadow-lift transition-colors hover:bg-periwinkle-deep disabled:opacity-60"
            >
              <BookOpen aria-hidden className="size-4" />
              {saving ? "Saving your book…" : "View my free book"}
            </button>
            <button
              type="button"
              onClick={onPdf}
              disabled={saving}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-page-line bg-white px-5 py-3 text-sm font-semibold text-page-ink transition-colors hover:border-periwinkle disabled:opacity-60"
            >
              <FileText aria-hidden className="size-4" />
              View PDF
            </button>
          </div>

          <p className="mt-4 flex items-center justify-center gap-1.5 text-xs text-page-ink-faint sm:justify-start">
            <LockKeyhole aria-hidden className="size-3.5" />
            Screen-resolution preview · print files are created only when you order
          </p>
        </div>
      </div>
    </section>
  );
}

function possessive(name: string): string {
  const clean = name.trim();
  if (!clean) return "Your pet’s";
  return /s$/i.test(clean) ? `${clean}’` : `${clean}’s`;
}
