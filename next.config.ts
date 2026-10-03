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
const securityHeaders = [
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
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
