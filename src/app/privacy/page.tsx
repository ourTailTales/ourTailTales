import type { Metadata } from "next";

import { LegalDoc, LegalSection } from "@/components/landing/LegalDoc";
import { brand } from "@/lib/brand";

export const metadata: Metadata = {
  title: `Privacy Policy — ${brand.name}`,
  description: `How ${brand.name} handles photos, emails, payments, and analytics.`,
};

const UPDATED = "September 14, 2026";

export default function PrivacyPage() {
  return (
    <LegalDoc title="Privacy Policy" updated={UPDATED}>
      <p>
        This Privacy Policy explains how {brand.name} (&ldquo;we,&rdquo;
        &ldquo;us&rdquo;) collects, uses, and shares information when you use{" "}
        {brand.domain} and related services (the &ldquo;Service&rdquo;).
      </p>

      <LegalSection title="1. Photos and videos on your device">
        <p>
          While you build a book, photo and video files you select are processed
          in your browser whenever possible. We do not receive your full album
          just because you open the editor.
        </p>
        <p>
          When you order a hardcover—or upload optional video memories—we
          receive the files needed to prepare print-ready pages, covers, and
          related assets. Those files are used to fulfill your order and operate
          the Service.
        </p>
      </LegalSection>

      <LegalSection title="2. Information we collect">
        <p>Depending on how you use the Service, we may collect:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            Contact details you provide, such as an email address for a sample
            PDF, order confirmation, or shipping updates.
          </li>
          <li>
            Order and shipping details needed to print and deliver a book
            (including pet name or book title if you enter them).
          </li>
          <li>
            Payment-related information processed by Stripe. We do not store
            full card numbers on our servers.
          </li>
          <li>
            Print files, cover files, and optional video memory files uploaded
            for fulfillment.
          </li>
          <li>
            Technical and usage data such as device type, pages visited, and
            product events, including through analytics providers.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="3. How we use information">
        <p>We use information to:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Create, preview, and fulfill hardcover books and related PDFs.</li>
          <li>Process payments and prevent fraud or abuse.</li>
          <li>Communicate about orders, samples, and service updates.</li>
          <li>Improve the product and understand how the funnel is used.</li>
          <li>Comply with law and enforce our Terms of Service.</li>
        </ul>
      </LegalSection>

      <LegalSection title="4. Sharing">
        <p>
          We share information with service providers who help us run the
          Service, including:
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Stripe for payment processing.</li>
          <li>Print and shipping partners (such as Lulu) for manufacturing and delivery.</li>
          <li>Hosting, storage, and database providers for files and order records.</li>
          <li>Analytics providers (such as PostHog and Vercel Analytics).</li>
        </ul>
        <p>
          We do not sell your personal information. We may disclose information
          if required by law or to protect rights, safety, or the integrity of
          the Service.
        </p>
      </LegalSection>

      <LegalSection title="5. Retention">
        <p>
          We keep order, contact, and fulfillment records for as long as needed
          to complete your order, provide support, meet legal obligations, and
          operate the business. Uploaded print and video assets may be retained
          for fulfillment and troubleshooting, then deleted or archived
          according to our operational needs.
        </p>
      </LegalSection>

      <LegalSection title="6. Cookies and similar technologies">
        <p>
          We and our providers may use cookies or similar technologies for
          essential site functions, payments, and analytics. You can control
          cookies through your browser settings; some features may not work if
          you block them.
        </p>
      </LegalSection>

      <LegalSection title="7. Children">
        <p>
          The Service is directed to adults creating keepsakes. It is not
          intended for children under 13, and we do not knowingly collect
          personal information from children under 13.
        </p>
      </LegalSection>

      <LegalSection title="8. Your choices">
        <p>
          You may request access to or deletion of personal information we hold
          about you, subject to legal and operational limits (for example, we
          may retain records needed for completed orders or accounting). Contact
          us using the details below.
        </p>
      </LegalSection>

      <LegalSection title="9. Changes">
        <p>
          We may update this Privacy Policy from time to time. The &ldquo;Last
          updated&rdquo; date at the top will change when we do. Continued use of
          the Service after an update means you accept the revised policy.
        </p>
      </LegalSection>

      <LegalSection title="10. Contact">
        <p>
          Questions about privacy:{" "}
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
