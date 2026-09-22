import type { ReactNode } from "react";

import { BrandMark } from "@/components/BrandMark";

export function SiteHeader({
  right,
  status,
  className,
}: {
  right?: ReactNode;
  /** Optional content shown just after the logo, top-left of the header. */
  status?: ReactNode;
  className?: string;
}) {
  return (
    <header className="flex items-center justify-between gap-4">
      <div className="flex min-w-0 items-center gap-3">
        <BrandMark href="/" size="md" priority className={className} />
        {status}
      </div>
      {right}
    </header>
  );
}
