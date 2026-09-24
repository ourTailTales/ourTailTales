import { Faq } from "@/components/landing/Faq";
import { Footer } from "@/components/landing/Footer";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { LandingHero } from "@/components/landing/LandingHero";
import { ProductListing } from "@/components/landing/ProductListing";
import { Testimonials } from "@/components/landing/Testimonials";

export function LandingPage() {
  return (
    <main className="relative w-full flex-1 pb-0">
      {/* 1. Hook + Dream Outcome visual — the site header lives inside it */}
      <LandingHero />

      {/* 3. How it works — now they believe it, so explain it */}
      <HowItWorks />

      {/* 5. Hardcover upgrade — natural next step after free PDF */}
      <ProductListing />

      {/* 5.5. Social proof — empty slots plus a review CTA until real reviews land. */}
      <Testimonials />

      {/* 6. FAQ + footer */}
      <div className="landing-rest">
        <Faq />
        <Footer />
      </div>
    </main>
  );
}
