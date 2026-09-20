import Link from "next/link";

import { BrandMark } from "@/components/BrandMark";
import { brand } from "@/lib/brand";

const legalLinkClass =
  "underline decoration-page-line underline-offset-4 transition-colors hover:text-periwinkle";

export function Footer() {
  return (
    <footer style={{ backgroundColor: "#7a5540" }}>
      <div className="mx-auto flex max-w-[90rem] flex-col gap-4 px-5 py-8 sm:flex-row sm:items-center sm:justify-between">
        <BrandMark href="/" size="sm" className="text-white/80" />
        <div className="flex flex-col gap-2 sm:items-end">
          <p className="text-xs leading-5 text-white/50">
            Photos stay on your device until you order. {brand.domain}
          </p>
          <nav
            aria-label="Legal"
            className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-white/50"
          >
            <Link href="/privacy" className={legalLinkClass}>
              Privacy Policy
            </Link>
            <Link href="/terms" className={legalLinkClass}>
              Terms of Service
            </Link>
          </nav>
        </div>
      </div>
    </footer>
  );
}
