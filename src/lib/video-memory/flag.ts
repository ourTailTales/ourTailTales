import { readEnv } from "@/lib/env";

/**
 * The one switch for Video Memories.
 *
 * Server-side only: `VIDEO_MEMORIES_ENABLED` carries no `NEXT_PUBLIC_` prefix,
 * so it is never inlined into a client bundle and this always reads as off in
 * the browser. Client components get the answer from a server component (see
 * `VideoMemoriesFlagProvider`) or from `/api/video-memory/config`.
 *
 * Off unless the value is exactly "true". While it is off the feature has no
 * UI, no landing copy, and its routes answer 404.
 */
export function videoMemoriesEnabled(): boolean {
  return readEnv("VIDEO_MEMORIES_ENABLED") === "true";
}

/**
 * First line of every Video Memory route: a 404 to send back while the
 * feature is off, or null when the route may proceed.
 */
export function videoMemoriesDisabledResponse(): Response | null {
  if (videoMemoriesEnabled()) return null;
  return Response.json({ error: "Not found." }, { status: 404 });
}
