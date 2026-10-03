import type { Metadata } from "next";

import { LegalDoc, LegalSection } from "@/components/landing/LegalDoc";
import { brand } from "@/lib/brand";
import { DRAFT_TTL_DAYS } from "@/lib/drafts/expiry";
import { videoMemoriesEnabled } from "@/lib/video-memory/flag";

export const metadata: Metadata = {
  title: `Privacy Policy | ${brand.name}`,
  description: `How ${brand.name} handles photos, emails, payments, and analytics.`,
};

const UPDATED = "October 3, 2026";

export default function PrivacyPage() {
  // Video Memory copy only appears while `VIDEO_MEMORIES_ENABLED` is on.
  const videoMemories = videoMemoriesEnabled();
  return (
    <LegalDoc title="Privacy Policy" updated={UPDATED}>
      <p>
        This Privacy Policy explains how {brand.name} (&ldquo;we,&rdquo;
        &ldquo;us&rdquo;) collects, uses, and shares information when you use{" "}
        {brand.domain} and related services (the &ldquo;Service&rdquo;).
      </p>

      <LegalSection title="1. Your photos and your book">
        <p>
          Your original photos are read on your own device. To write the
          story, small previews of your photos are sent to our servers, along
          with the pet name and any notes you give us. We also send the date
          each photo was taken and, if your photos carry a location, the
          rough area where they were taken.
        </p>
        <p>
          Once the story is written, your preview book is uploaded and stored
          so we can show it to you and email you a link. The preview book is a
          PDF that contains your photos.
        </p>
        <p>
          If you create a free account or buy the digital PDF, the full book
          is uploaded and stored. If you order a hardcover, the print files
          for the pages and cover are uploaded so the book can be printed.
        </p>
      </LegalSection>

      <LegalSection title="2. Information we collect">
        <p>Depending on how you use the Service, we collect:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Your email address.</li>
          <li>Your pet&rsquo;s name and any notes you add about them.</li>
          <li>
            Small previews of your photos, and the finished book file, which
            contains your photos and the story.
          </li>
          <li>
            The dates your photos were taken, and the rough area where they
            were taken if your photos carry it. We use these to name seasons
            and places in the story.
          </li>
          <li>
            Your name, shipping address and phone number at checkout, if you
            order a hardcover.
          </li>
          <li>
            Your account email and a hashed password, if you create an
            account. We do not store the password itself.
          </li>
          <li>
            Payment details, which are handled by Stripe. We do not store full
            card numbers on our servers.
          </li>
          <li>
            Usage data such as device type, pages visited and actions taken in
            the product.
          </li>
          {videoMemories ? (
            <li>Video files, if you add optional video memories.</li>
          ) : null}
        </ul>
      </LegalSection>

      <LegalSection title="3. How we use information">
        <p>We use information to:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Write, preview, print and deliver your book.</li>
          <li>Process payments and prevent fraud or abuse.</li>
          <li>Email you about your book, your order and your account.</li>
          <li>Understand how the product is used and improve it.</li>
          <li>Comply with law and enforce our Terms of Service.</li>
        </ul>
      </LegalSection>

      <LegalSection title="4. Service providers">
        <p>
          We share information with the companies that help us run the
          Service. Each one receives only what it needs for its job:
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            Google (Gemini): writes the story. It receives your photo
            previews, the dates they were taken, city names, the pet name and
            your notes.
          </li>
          <li>
            OpenStreetMap (Nominatim): turns a rough map area into a city
            name. It receives rounded coordinates, never a photo.
          </li>
          <li>
            Supabase: our database, file storage and accounts. It holds your
            book files, order records and account details.
          </li>
          <li>Stripe: takes payments.</li>
          <li>
            Lulu: prints and ships hardcover books. It receives the print
            files and your shipping details.
          </li>
          <li>Resend: sends our emails.</li>
          <li>
            PostHog: product analytics. It receives usage data and, once you
            give it to us, your email address.
          </li>
          <li>Vercel: hosts the website and provides site analytics.</li>
        </ul>
        <p>
          We do not sell your personal information. We may disclose information
          if required by law or to protect rights, safety, or the integrity of
          the Service.
        </p>
      </LegalSection>

      <LegalSection title="5. How long we keep it">
        <ul className="list-disc space-y-1 pl-5">
          <li>
            Free preview books and their links are deleted {DRAFT_TTL_DAYS}{" "}
            days after they were last saved, unless you buy the book. If you
            make a free account, a separate copy is kept in your library. The
            pet name stored with the preview is deleted at the same time.
          </li>
          <li>
            Your email address is kept so we can find your book and your
            orders. Ask us and we will delete it.
          </li>
          <li>
            Hardcover print files are deleted about 60 days after you order,
            so we can reprint a damaged book.
          </li>
          <li>
            Books saved to an account, and your account details, are kept
            until you ask us to delete them.
          </li>
          <li>
            Order and payment records are kept for as long as we need them for
            support, accounting and legal reasons.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="6. Cookies and analytics">
        <p>
          We use PostHog and Vercel analytics to see how the site is used.
          This stores an identifier in your browser. Our payment and account
          providers also store what they need in your browser to keep you
          signed in and to take payment.
        </p>
        <p>
          You can clear or block this in your browser settings. Some features
          may not work if you block it. You can also ask us to delete your
          data. See section 8.
        </p>
      </LegalSection>

      <LegalSection title="7. Children">
        <p>
          The Service is directed to adults creating keepsakes. It is not
          intended for children under 13, and we do not knowingly collect
          personal information from children under 13.
        </p>
      </LegalSection>

      <LegalSection title="8. Deleting your information">
        <p>
          To have your photos, books, account or other personal information
          deleted, or to ask for a copy of it, email{" "}
          <a
            href={`mailto:hello@${brand.domain}`}
            className="text-periwinkle underline decoration-page-line underline-offset-4"
          >
            hello@{brand.domain}
          </a>{" "}
          from the address you used with us. We may need to keep some records
          of completed orders for accounting and legal reasons.
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
