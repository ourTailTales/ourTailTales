import { Faq } from "@/components/landing/Faq";
import { Footer } from "@/components/landing/Footer";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { LandingHero } from "@/components/landing/LandingHero";
import { ProductListing } from "@/components/landing/ProductListing";
import { SiteHeader } from "@/components/SiteHeader";

export function LandingPage() {
  return (
    <main className="w-full flex-1 pb-0">
      {/* 1. Hook + Dream Outcome visual (hardcover mockup) */}
      <LandingHero header={<SiteHeader />} />


      {/* 3. How it works — now they believe it, so explain it */}
      <HowItWorks />

      {/* 5. Hardcover upgrade — natural next step after free PDF */}
      <ProductListing />

      {/* 6. FAQ + footer */}
      <div className="landing-rest">
        <Faq />
        <Footer />
      </div>
    </main>
  );
}
