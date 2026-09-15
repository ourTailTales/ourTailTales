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
      throw new Error(
        `${missing} variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once ${missing} is configured`,
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
