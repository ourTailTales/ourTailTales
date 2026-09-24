import posthog from "posthog-js";

import { redactProperties } from "@/lib/analytics-redact";
import { firstTouchFromLocation } from "@/lib/attribution";

const token = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
const host = process.env.NEXT_PUBLIC_POSTHOG_HOST;

if (!token && process.env.NODE_ENV === "development") {
  throw new Error(
    "NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN is configured",
  );
}

if (!host && process.env.NODE_ENV === "development") {
  throw new Error(
    "NEXT_PUBLIC_POSTHOG_HOST variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once NEXT_PUBLIC_POSTHOG_HOST is configured",
  );
}

// Local development runs against the same project token, so its traffic —
// especially dev-server compilation errors captured as exceptions — reaches
// production error tracking as noise. Drop every event that starts on a
// localhost host and keep production capture untouched.
function isLocalhost(): boolean {
  if (typeof window === "undefined") return false;
  const { hostname } = window.location;
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "0.0.0.0" ||
    hostname === "[::1]" ||
    hostname.endsWith(".local")
  );
}

if (token && host) {
  posthog.init(token, {
    api_host: host,
    defaults: "2026-01-30",
    // Most people make a book long before they give an address or make an
    // account. With the default ("identified_only") those anonymous visitors
    // get no person profile, so the first-touch source a funnel is broken
    // down by was never recorded for the people the funnel is about.
    person_profiles: "always",
    capture_exceptions: true,
    // Every event on localhost is dropped just below, so debug mode there
    // would only ever print "this event was rejected" — never anything
    // worth debugging, and PostHog logs that rejection loudly to the
    // console on every single event. Off on localhost, on anywhere debug
    // output might actually say something.
    debug: process.env.NODE_ENV === "development" && !isLocalhost(),
    before_send: (event) => {
      if (isLocalhost()) return null;
      // Autocapture and pageviews land here too, not only this app's own
      // track() calls, which is exactly where a draft secret or order token
      // sitting in $current_url/$referrer would otherwise leak through.
      if (event) event.properties = redactProperties(event.properties);
      return event;
    },
  });

  recordFirstTouch();
}

/**
 * Stamps where this visitor first came from, once, as both a super property
 * (on every later event from this browser) and a set-once person property
 * (so server-side events like `order_completed` can be broken down by it).
 */
function recordFirstTouch(): void {
  if (posthog.get_property("first_touch_channel")) return;
  const touch = firstTouchFromLocation();
  if (!touch) return;

  const properties = {
    first_touch_channel: touch.channel,
    first_touch_referring_domain: touch.referringDomain ?? "$direct",
    first_touch_utm_source: touch.utmSource ?? "",
    first_touch_utm_medium: touch.utmMedium ?? "",
    first_touch_utm_campaign: touch.utmCampaign ?? "",
    first_touch_landing_path: touch.landingPath,
  };
  posthog.register_once(properties);
  posthog.setPersonProperties(undefined, properties);
}
