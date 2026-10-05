import type { MetadataRoute } from "next";

import { SITE_URL } from "@/lib/env";

/**
 * What search engines may read.
 *
 * The landing page and the two legal pages are the public site. Everything
 * else is one person's book, their checkout or their account, reached by a
 * private link, and has no business in a search result. Those pages already
 * carry `noindex`; this keeps crawlers from fetching them at all.
 *
 * On a preview deployment nothing is offered, so a rehearsal never competes
 * with the real site in search.
 */
export default function robots(): MetadataRoute.Robots {
  if (process.env.VERCEL_ENV && process.env.VERCEL_ENV !== "production") {
    return { rules: { userAgent: "*", disallow: "/" } };
  }

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/api/",
        "/auth/",
        "/book/",
        "/checkout",
        "/claim/",
        "/create",
        "/order/",
        "/reset-password",
      ],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
