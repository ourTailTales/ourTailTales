import type { Metadata } from "next";
import Link from "next/link";

import { LegalDoc, LegalSection } from "@/components/landing/LegalDoc";
import { brand } from "@/lib/brand";

export const metadata: Metadata = {
  title: `Terms of Service | ${brand.name}`,
  description: `Terms for using ${brand.name} to create and order hardcover pet books.`,
};

const UPDATED = "September 14, 2026";

export default function TermsPage() {
  return (
    <LegalDoc title="Terms of Service" updated={UPDATED}>
      <p>
        These Terms of Service (&ldquo;Terms&rdquo;) govern your access to and
        use of {brand.name} at {brand.domain} and related services (the
        &ldquo;Service&rdquo;). By using the Service, you agree to these Terms.
      </p>

      <LegalSection title="1. The Service">
        <p>
          {brand.name} helps you turn a pet photo album into a hardcover book.
          Features may include on-device organization, chapter editing, PDF
          previews or samples, optional video memories, and print fulfillment
          through third-party partners.
        </p>
        <p>
          We may change, suspend, or discontinue parts of the Service at any
          time. We do not guarantee uninterrupted or error-free operation.
        </p>
      </LegalSection>

      <LegalSection title="2. Eligibility">
        <p>
          You must be at least 18 years old (or the age of majority where you
          live) and able to form a binding contract to place an order. You are
          responsible for the accuracy of information you provide.
        </p>
      </LegalSection>

      <LegalSection title="3. Your content">
        <p>
          You retain ownership of photos, videos, captions, and other materials
          you submit (&ldquo;Content&rdquo;). You grant us a limited license to
          host, process, reproduce, and transmit Content solely as needed to
          provide the Service, including generating previews, print files, and
          shipping a finished book.
        </p>
        <p>
          You represent that you have the rights needed to use the Content and
          that it does not infringe others&rsquo; rights or violate law. You are
          responsible for Content you upload.
        </p>
      </LegalSection>

      <LegalSection title="4. Orders and payment">
        <p>
          Prices, chapter counts, shipping, and taxes shown at checkout apply to
          that order. Payment is processed by Stripe. Placing an order is an
          offer to purchase; we may decline or cancel an order (for example, if
          payment fails, files cannot be printed, or we suspect fraud).
        </p>
        <p>
          Once a book is in production with our print partner, changes or
          cancellations may not be possible. Contact us promptly if something is
          wrong with an order confirmation.
        </p>
      </LegalSection>

      <LegalSection title="5. Shipping and fulfillment">
        <p>
          Delivery estimates are approximate. Risk of loss passes according to
          the carrier and print partner&rsquo;s practices. International orders
          may be subject to customs, duties, or local restrictions that are your
          responsibility unless we expressly state otherwise.
        </p>
      </LegalSection>

      <LegalSection title="6. Acceptable use">
        <p>You agree not to:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Misuse the Service or attempt unauthorized access.</li>
          <li>Upload unlawful, harmful, or infringing Content.</li>
          <li>Interfere with other users or our infrastructure.</li>
          <li>Reverse engineer or scrape the Service except as allowed by law.</li>
        </ul>
      </LegalSection>

      <LegalSection title="7. Intellectual property">
        <p>
          The Service, branding, software, and design are owned by {brand.name}{" "}
          or its licensors. These Terms do not transfer those rights to you,
          except for the limited license to use the Service as provided.
        </p>
      </LegalSection>

      <LegalSection title="8. Disclaimers">
        <p>
          THE SERVICE IS PROVIDED &ldquo;AS IS&rdquo; AND &ldquo;AS
          AVAILABLE.&rdquo; TO THE FULLEST EXTENT PERMITTED BY LAW, WE DISCLAIM
          WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND
          NON-INFRINGEMENT. We do not warrant that previews will match the final
          printed book exactly, or that colors and crops will be identical across
          devices and print runs.
        </p>
      </LegalSection>

      <LegalSection title="9. Limitation of liability">
        <p>
          TO THE FULLEST EXTENT PERMITTED BY LAW, {brand.name.toUpperCase()} AND
          ITS PROVIDERS WILL NOT BE LIABLE FOR INDIRECT, INCIDENTAL, SPECIAL,
          CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR FOR LOST PROFITS, DATA, OR
          GOODWILL. OUR TOTAL LIABILITY FOR ANY CLAIM ARISING OUT OF THE SERVICE
          IS LIMITED TO THE AMOUNT YOU PAID US FOR THE ORDER GIVING RISE TO THE
          CLAIM IN THE TWELVE MONTHS BEFORE THE CLAIM.
        </p>
      </LegalSection>

      <LegalSection title="10. Privacy">
        <p>
          Our{" "}
          <Link
            href="/privacy"
            className="text-periwinkle underline decoration-page-line underline-offset-4"
          >
            Privacy Policy
          </Link>{" "}
          describes how we handle personal information. By using the Service,
          you also acknowledge that policy.
        </p>
      </LegalSection>

      <LegalSection title="11. Changes">
        <p>
          We may update these Terms from time to time. The &ldquo;Last
          updated&rdquo; date will change when we do. Continued use after an
          update means you accept the revised Terms. If you do not agree, stop
          using the Service.
        </p>
      </LegalSection>

      <LegalSection title="12. Contact">
        <p>
          Questions about these Terms:{" "}
          <a
            href={`mailto:hello@${brand.domain}`}
            className="text-periwinkle underline decoration-page-line underline-offset-4"
          >
            hello@{brand.domain}
          </a>
          .
        </p>
      </LegalSection>
    </LegalDoc>
  );
}
