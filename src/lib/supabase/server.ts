import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { isConfigured, readEnv, requireEnv } from "@/lib/env";

/**
 * Server-only Supabase access.
 *
 * The service-role key never leaves the server: no Supabase client is ever
 * constructed in the browser, and the storage bucket is private. Clients only
 * ever receive short-lived signed URLs minted by route handlers.
 */

export const STORAGE_BUCKET =
  readEnv("SUPABASE_STORAGE_BUCKET") ?? "ourtailtales-orders";

/**
 * Preview books — free drafts and saved book projects alike. Private, like
 * every other bucket; readers only ever get signed URLs.
 */
export const PREVIEW_BUCKET = "book-previews";

let cached: SupabaseClient | null = null;

export function supabaseAdmin(): SupabaseClient {
  if (cached) return cached;

  const [url, serviceRoleKey] = requireEnv(
    "NEXT_PUBLIC_SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
  );

  cached = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}

export function supabaseConfigured(): boolean {
  return isConfigured("NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY");
}

/** Object paths for one order's temporary print files. */
export function orderAssetPath(
  orderId: string,
  kind: "interior" | "cover",
): string {
  return `orders/${orderId}/${kind}.pdf`;
}
