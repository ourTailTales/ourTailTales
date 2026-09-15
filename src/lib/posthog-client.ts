import posthog from "posthog-js";

export function postHogHeaders(): Record<string, string> {
  if (!process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN) return {};

  const headers: Record<string, string> = {
    "X-POSTHOG-DISTINCT-ID": posthog.get_distinct_id(),
  };
  const sessionId = posthog.get_session_id();
  if (sessionId) headers["X-POSTHOG-SESSION-ID"] = sessionId;
  return headers;
}
