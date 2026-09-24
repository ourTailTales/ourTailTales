/**
 * Where a visitor came from, as one normalised channel name.
 *
 * PostHog already stores the raw first-touch properties on each person
 * ($initial_referring_domain, $initial_utm_source, ...). They are too
 * scattered to break a funnel down by: "l.instagram.com", "instagram.com",
 * "ig" and "Instagram" are four rows for one source. This folds them into a
 * single `first_touch_channel` person property, set once, which is what the
 * "book created → ordered" funnel is broken down by.
 *
 * Pure so it can be tested without a browser; `firstTouchFromLocation` reads
 * the page.
 */

export type Touch = {
  channel: string;
  /** Referring host, or null for direct / same-site. */
  referringDomain: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  landingPath: string;
};

const SOURCE_ALIASES: Record<string, string> = {
  ig: "instagram",
  insta: "instagram",
  instagram: "instagram",
  fb: "facebook",
  facebook: "facebook",
  meta: "facebook",
  tiktok: "tiktok",
  tt: "tiktok",
  google: "google",
  adwords: "google",
  bing: "bing",
  pinterest: "pinterest",
  pin: "pinterest",
  reddit: "reddit",
  twitter: "twitter",
  x: "twitter",
  youtube: "youtube",
  yt: "youtube",
  email: "email",
  newsletter: "email",
  resend: "email",
};

/** Host suffix → channel, checked in order. */
const REFERRER_CHANNELS: [RegExp, string][] = [
  [/(^|\.)instagram\.com$/, "instagram"],
  [/(^|\.)(facebook\.com|fb\.com|fb\.me|messenger\.com)$/, "facebook"],
  [/(^|\.)tiktok\.com$/, "tiktok"],
  [/(^|\.)google\.[a-z.]+$/, "google"],
  [/(^|\.)bing\.com$/, "bing"],
  [/(^|\.)duckduckgo\.com$/, "duckduckgo"],
  [/(^|\.)pinterest\.[a-z.]+$/, "pinterest"],
  [/(^|\.)reddit\.com$/, "reddit"],
  [/(^|\.)(t\.co|twitter\.com|x\.com)$/, "twitter"],
  [/(^|\.)(youtube\.com|youtu\.be)$/, "youtube"],
  [/(^|\.)(mail\.google\.com|outlook\.live\.com|mail\.yahoo\.com)$/, "email"],
  [/(^|\.)(chatgpt\.com|openai\.com|perplexity\.ai|claude\.ai)$/, "ai_assistant"],
];

function clean(value: string | null | undefined): string | null {
  const trimmed = value?.trim().toLowerCase();
  return trimmed ? trimmed.slice(0, 100) : null;
}

export function classifyTouch(args: {
  url: string;
  referrer: string;
  ownHost: string;
}): Touch {
  let params = new URLSearchParams();
  let landingPath = "/";
  try {
    const url = new URL(args.url);
    params = url.searchParams;
    landingPath = url.pathname;
  } catch {
    // Keep defaults.
  }

  let referringDomain: string | null = null;
  try {
    const host = args.referrer ? new URL(args.referrer).hostname.replace(/^www\./, "") : "";
    const own = args.ownHost.replace(/^www\./, "");
    referringDomain = host && host !== own ? host : null;
  } catch {
    referringDomain = null;
  }

  const utmSource = clean(params.get("utm_source"));
  const utmMedium = clean(params.get("utm_medium"));
  const utmCampaign = clean(params.get("utm_campaign"));

  const channel = (() => {
    if (utmMedium === "email") return "email";
    if (utmSource) return SOURCE_ALIASES[utmSource] ?? utmSource;
    // Click ids survive when a platform strips the referrer.
    if (params.has("fbclid")) return "facebook";
    if (params.has("gclid") || params.has("gbraid") || params.has("wbraid")) return "google";
    if (params.has("ttclid")) return "tiktok";
    if (params.has("epik")) return "pinterest";
    if (!referringDomain) return "direct";
    for (const [pattern, name] of REFERRER_CHANNELS) {
      if (pattern.test(referringDomain)) return name;
    }
    return referringDomain;
  })();

  return { channel, referringDomain, utmSource, utmMedium, utmCampaign, landingPath };
}

export function firstTouchFromLocation(): Touch | null {
  if (typeof window === "undefined") return null;
  return classifyTouch({
    url: window.location.href,
    referrer: document.referrer,
    ownHost: window.location.hostname,
  });
}
