import type { ReactNode } from "react";

import { BrandMark } from "@/components/BrandMark";

export function SiteHeader({
  right,
  className,
}: {
  right?: ReactNode;
  className?: string;
}) {
  return (
    <header className="flex items-center justify-between gap-4">
      <BrandMark href="/" size="md" priority className={className} />
      {right}
    </header>
  );
}
