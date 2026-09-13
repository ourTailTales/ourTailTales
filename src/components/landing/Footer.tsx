import { BrandMark } from "@/components/BrandMark";
import { brand } from "@/lib/brand";

export function Footer() {
  return (
    <footer>
      <div className="mx-auto flex max-w-[90rem] flex-col gap-3 px-5 py-8 sm:flex-row sm:items-center sm:justify-between">
        <BrandMark href="/" size="sm" />
        <p className="text-xs leading-5 text-ink-soft">
          Photos stay on your device until you order. {brand.domain}
        </p>
      </div>
    </footer>
  );
}
