/**
 * Keeps live credentials out of analytics.
 *
 * A free book opens at `/book/<id>?k=<secret>`, and checkout at
 * `/checkout?order=<id>&t=<orderToken>` — both query parameters are the
 * whole credential, not a lookup key, so anyone holding one can read the
 * book or touch the order. PostHog captures `$current_url` and `$referrer`
 * verbatim, so without this the key to every book and order sits in the
 * analytics pipeline. Wired into `posthog.init`'s `before_send` in
 * `instrumentation-client.ts`, which runs on every event, not only the ones
 * this app calls `track()` on — autocapture and pageviews go through it too.
 *
 * Exported separately from `analytics.ts` so it can be unit tested without
 * pulling posthog-js into the test run.
 */

/**
 * Query parameters that must never leave the browser in an event property.
 * `email` is not a credential, but `/create?email=` put every lead's address
 * into `$current_url` on every event from that page. The address reaches
 * PostHog once, deliberately, as a person property.
 */
const SECRET_PARAMS = ["k", "t", "email"];

const REDACTED = "redacted";

export function redactUrl(value: string): string {
  // Events carry relative paths as well as absolute URLs, so parse against a
  // throwaway base and put back whichever form came in.
  let url: URL;
  try {
    url = new URL(value, "https://redacted.invalid");
  } catch {
    return value;
  }

  let changed = false;
  for (const param of SECRET_PARAMS) {
    if (url.searchParams.has(param)) {
      url.searchParams.set(param, REDACTED);
      changed = true;
    }
  }
  if (!changed) return value;

  return /^[a-z][a-z0-9+.-]*:/i.test(value)
    ? url.toString()
    : `${url.pathname}${url.search}${url.hash}`;
}

/**
 * Applied to every outgoing event. Any string property that carries a
 * redactable parameter is rewritten, rather than listing PostHog's URL
 * properties by name — that list grows, and missing one leaks a key.
 *
 * Nested objects are walked too: `$set` and `$set_once` carry the person's
 * initial URL and referrer, which are the same URLs one level down.
 */
export function redactProperties<T extends Record<string, unknown>>(
  properties: T,
): T {
  for (const [key, value] of Object.entries(properties)) {
    if (
      typeof value === "string" &&
      SECRET_PARAMS.some((param) => value.includes(`${param}=`))
    ) {
      (properties as Record<string, unknown>)[key] = redactUrl(value);
    } else if (value && typeof value === "object" && !Array.isArray(value)) {
      redactProperties(value as Record<string, unknown>);
    }
  }
  return properties;
}
