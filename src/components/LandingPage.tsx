import { Faq } from "@/components/landing/Faq";
import { Footer } from "@/components/landing/Footer";
import { LandingHero } from "@/components/landing/LandingHero";
import { ProductListing } from "@/components/landing/ProductListing";
import { SiteHeader } from "@/components/SiteHeader";
import { Funnel } from "@/components/Funnel";

export function LandingPage() {
  return (
    <main className="w-full flex-1 pb-0">
      <LandingHero header={<SiteHeader />} />
      <div className="book-creation-field">
        <ProductListing />
        <Funnel embedded />
      </div>
      <div className="landing-rest">
        <Faq />
        <Footer />
      </div>
    </main>
  );
}
