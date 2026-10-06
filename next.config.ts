import type { NextConfig } from "next";

/**
 * Sent with every response.
 *
 * None of these were set, so the checkout and the account pages could be
 * framed by another site, and whether a book link's secret reached a third
 * party in a Referer header was left to each browser's default.
 *
 * `frame-ancestors` and `X-Frame-Options` say the same thing to new and old
 * browsers: nobody may put these pages in a frame. Stripe's card fields are
 * frames inside our page, which this does not affect.
 */
/**
 * Where the page may load things from.
 *
 * Until now the policy only said who may frame us. This says what we may run
 * and talk to, so a script injected into a page has nowhere to send what it
 * reads and nothing foreign can be pulled in.
 *
 * What each allowance is for:
 * - Stripe: its script, its card and wallet frames, and its API.
 * - Supabase: sign-in, direct uploads of print files and book PDFs, and the
 *   signed links the saved-book page shows in a frame.
 * - PostHog and Vercel: analytics.
 * - `blob:` and `data:`: photographs and PDFs made in the browser.
 *
 * Inline scripts and styles are allowed because Next.js and Tailwind emit
 * them; a nonce would stop the pages being static. Development additionally
 * needs `unsafe-eval` and a websocket for hot reload.
 */
const dev = process.env.NODE_ENV !== "production";
const supabaseOrigin = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").origin;
  } catch {
    return "https://*.supabase.co";
  }
})();
const posthogOrigins = "https://*.posthog.com";
const stripeOrigins = "https://*.stripe.com https://*.stripe.network";

const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${dev ? " 'unsafe-eval'" : ""} ${stripeOrigins} ${posthogOrigins} https://va.vercel-scripts.com`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: ${supabaseOrigin} ${stripeOrigins}`,
  "font-src 'self' data:",
  `connect-src 'self' ${supabaseOrigin} ${supabaseOrigin.replace("https://", "wss://")} ${stripeOrigins} ${posthogOrigins} https://vitals.vercel-insights.com https://va.vercel-scripts.com${dev ? " ws: http://localhost:*" : ""}`,
  `frame-src 'self' blob: ${supabaseOrigin} ${stripeOrigins}`,
  "worker-src 'self' blob:",
  "media-src 'self' blob: data:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), browsing-topics=()",
  },
  {
    key: "Strict-Transport-Security",
    // This host only. Subdomains are not all ours to promise HTTPS for.
    value: "max-age=63072000",
  },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
