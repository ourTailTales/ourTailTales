"use client";

import Image from "next/image";
import type { ReactNode } from "react";

import { brand } from "@/lib/brand";

/** Hardcover front — Memory Blue cloth + cover typography. */
export function CoverFrontArt() {
  return (
    <div className="relative flex h-full w-full flex-col items-center justify-between bg-memory-blue px-[12%] py-[12%] text-center text-ink">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          backgroundImage:
            "repeating-linear-gradient(98deg, transparent 0 2px, rgb(37 42 58 / 0.07) 2px 3px)",
        }}
      />
      <div className="relative flex flex-col items-center gap-4">
        <Image
          src={brand.logo.src}
          alt=""
          width={112}
          height={112}
          className="h-[4.5rem] w-[4.5rem] drop-shadow-sm sm:h-[5.5rem] sm:w-[5.5rem]"
          priority
        />
        <h1 className="max-w-[16ch] text-balance font-cover text-[clamp(1.15rem,2.8vw,1.85rem)] font-semibold leading-[1.12] tracking-[-0.01em]">
          {brand.title}
        </h1>
        <p className="max-w-[22ch] font-cover text-[clamp(0.8rem,1.5vw,0.95rem)] font-medium italic leading-snug text-ink-soft">
          {brand.line}
        </p>
      </div>
      <div className="relative flex flex-col items-center gap-2">
        <span aria-hidden className="h-px w-10 bg-ink/25" />
        <p className="font-cover text-sm font-medium tracking-[0.04em]">
          {brand.name}
        </p>
      </div>
    </div>
  );
}

export function CoverInsideArt({ children }: { children?: ReactNode }) {
  return (
    <div className="relative h-full w-full bg-[#fbfcff]">
      <div aria-hidden className="absolute inset-y-0 right-0 w-[5%] bg-ink/[0.05]" />
      {children ? (
        <div className="relative flex h-full flex-col overflow-auto p-6 sm:p-8">
          {children}
        </div>
      ) : null}
    </div>
  );
}

export function BackCoverArt() {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center bg-memory-blue px-10 text-center">
      <p className="font-cover text-lg text-ink">{brand.name}</p>
      <p className="mt-2 font-cover text-sm italic text-ink-soft">{brand.line}</p>
    </div>
  );
}
