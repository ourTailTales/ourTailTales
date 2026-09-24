import posthog from "posthog-js";

import { redactProperties } from "@/lib/analytics-redact";

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
}
