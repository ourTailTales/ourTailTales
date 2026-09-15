import type { PostHog } from "posthog-node";

export async function flushPostHog(client: PostHog | null): Promise<void> {
  if (client) await client.flush();
}
