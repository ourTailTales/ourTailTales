import { PostHog } from "posthog-node";

let posthogClient: PostHog | null = null;

export function getPostHogClient(): PostHog | null {
  const token = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
  const host = process.env.NEXT_PUBLIC_POSTHOG_HOST;

  if (!token || !host) {
    if (process.env.NODE_ENV === "development") {
      const missing = token
        ? "NEXT_PUBLIC_POSTHOG_HOST"
        : "NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN";
      // Loud, but never a thrown error: this used to throw here, and every
      // caller sits in front of business logic that has nothing to do with
      // analytics. A payment webhook that crashes on a missing PostHog token
      // stops a real, already-charged order dead — after it is marked paid,
      // before it ever reaches the printer — with nothing in the order's own
      // state to say why. Missing instrumentation must never be able to do
      // that; it only ever gets to mean "this event was not recorded".
      console.error(
        `[ourTailTales] ${missing} variable required by PostHog is missing or un-configured — events are being silently missed. This stops appearing once ${missing} is configured.`,
      );
    }
    return null;
  }

  posthogClient ??= new PostHog(token, {
    host,
    flushAt: 1,
    flushInterval: 0,
    enableExceptionAutocapture: true,
  });

  return posthogClient;
}

export function postHogDistinctId(
  request: Request,
  fallback: string,
): string {
  return request.headers.get("x-posthog-distinct-id") || fallback;
}

export async function captureServerEvent(
  distinctId: string,
  event: string,
  properties?: Record<string, string | number | boolean>,
): Promise<void> {
  const client = getPostHogClient();
  if (!client) return;

  try {
    client.capture({ distinctId, event, properties });
    await client.flush();
  } catch (error) {
    console.warn("[ourTailTales] PostHog event delivery failed", error);
  }
}

export async function captureServerException(
  error: unknown,
  distinctId: string,
): Promise<void> {
  const client = getPostHogClient();
  if (!client) return;

  try {
    client.captureException(error, distinctId);
    await client.flush();
  } catch (captureError) {
    console.warn("[ourTailTales] PostHog exception delivery failed", captureError);
  }
}
