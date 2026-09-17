import { BrandMark } from "@/components/BrandMark";

export function SiteHeader() {
  return (
    <header className="flex items-center justify-between gap-4">
      <BrandMark href="/" size="md" priority />
    </header>
  );
}
