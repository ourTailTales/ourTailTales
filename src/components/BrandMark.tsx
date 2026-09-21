import Image from "next/image";
import Link from "next/link";

import { brand } from "@/lib/brand";

const SIZES = {
  sm: { px: 28, text: "text-lg" },
  md: { px: 40, text: "text-xl" },
  lg: { px: 52, text: "text-2xl" },
} as const;

export function BrandMark({
  href = "/",
  size = "md",
  showWordmark = true,
  priority = false,
  className,
}: {
  href?: string | null;
  size?: keyof typeof SIZES;
  showWordmark?: boolean;
  priority?: boolean;
  className?: string;
}) {
  const { px, text } = SIZES[size];

  const mark = (
    <span
      className={`inline-flex items-center gap-2.5 ${className ?? "text-ink"}`}
    >
      <Image
        src={brand.logo.src}
        alt={showWordmark ? "" : brand.name}
        width={px}
        height={px}
        priority={priority}
        className="shrink-0"
      />
      {showWordmark ? (
        <span className={`font-display tracking-tight ${text}`}>{brand.name}</span>
      ) : null}
    </span>
  );

  if (!href) return mark;

  return (
    <Link
      href={href}
      className="inline-flex rounded-sm transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-periwinkle"
      aria-label={showWordmark ? undefined : brand.name}
    >
      {mark}
    </Link>
  );
}
