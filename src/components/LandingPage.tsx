import { Faq } from "@/components/landing/Faq";
import { Footer } from "@/components/landing/Footer";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { LandingHero } from "@/components/landing/LandingHero";
import { ProductListing } from "@/components/landing/ProductListing";
import { Testimonials } from "@/components/landing/Testimonials";
import { SiteHeader } from "@/components/SiteHeader";

export function LandingPage() {
  return (
    <main className="relative w-full flex-1 pb-0">
      {/* Site header — top-left, overlaying the hero */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-20">
        <div className="pointer-events-auto mx-auto w-full max-w-[100rem] px-5 pt-5 sm:px-8 sm:pt-6 lg:pl-8 lg:pr-14">
          <SiteHeader className="text-white" />
        </div>
      </div>

      {/* 1. Hook + Dream Outcome visual (hardcover mockup) */}
      <LandingHero />

      {/* 3. How it works — now they believe it, so explain it */}
      <HowItWorks />

      {/* 5. Hardcover upgrade — natural next step after free PDF */}
      <ProductListing />

      {/* 5.5. Social proof — placeholder content, see Testimonials.tsx TODO */}
      <Testimonials />

      {/* 6. FAQ + footer */}
      <div className="landing-rest">
        <Faq />
        <Footer />
      </div>
    </main>
  );
}
