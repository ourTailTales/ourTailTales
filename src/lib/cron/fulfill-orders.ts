import { fulfillNextVideoMemory } from "@/lib/archival/fulfill";

/**
 * Extracted from the route handler so the daily dispatcher can call it
 * directly, without a second HTTP hop or a second cold start.
 */
export async function fulfillOrders(): Promise<Record<string, unknown>> {
  const processed = await fulfillNextVideoMemory();

  return { processed };
}
