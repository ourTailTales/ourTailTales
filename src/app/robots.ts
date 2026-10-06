import type { MetadataRoute } from "next";

import { SITE_URL } from "@/lib/env";

/**
 * What search engines may read.
 *
 * The landing page and the two legal pages are the public site. Everything
 * else is one person's book, their checkout or their account, reached by a
 * private link. Those pages are kept out of search by the `noindex` they
 * carry, and that only works if a crawler is allowed to fetch the page and
 * see it: a page blocked here can still be listed by its bare address when
 * somebody links to it. So only the routes that are not pages at all are
 * blocked.
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
      disallow: ["/api/", "/auth/"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
