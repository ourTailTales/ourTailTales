import { z } from "zod";

import { CENTROID_PRECISION } from "@/lib/geo";
import { SITE_URL, readEnv, routeError } from "@/lib/env";
import { LIMITS, enforceRateLimit } from "@/lib/rate-limit";

/**
 * Reverse geocoding for chapter place labels.
 *
 * Only reduced-precision cluster centroids arrive here — never individual photo
 * coordinates. Only city, region, and country are returned, so the book can
 * name a place without ever exposing a home address.
 */

const requestSchema = z.object({
  points: z
    .array(z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) }))
    .max(5),
});

const PROVIDER_URL =
  readEnv("GEOCODE_URL") ?? "https://nominatim.openstreetmap.org/reverse";

export async function POST(request: Request): Promise<Response> {
  try {
    const limited = await enforceRateLimit(request, LIMITS.geocode);
    if (limited) return limited;

    const parsed = requestSchema.safeParse(await request.json());
    if (!parsed.success) {
      return Response.json({ error: "Invalid coordinates." }, { status: 400 });
    }

    const places = [];
    for (const point of parsed.data.points) {
      places.push(await lookup(coarsen(point.lat), coarsen(point.lng)));
    }

    return Response.json({ places: places.filter((place) => place !== null) });
  } catch (error) {
    return routeError(error, "Could not look up those places.");
  }
}

/** Defence in depth: re-round on the server before calling out. */
function coarsen(value: number): number {
  const factor = 10 ** CENTROID_PRECISION;
  return Math.round(value * factor) / factor;
}

async function lookup(
  lat: number,
  lng: number,
): Promise<{ city?: string; region?: string; country?: string } | null> {
  const url = new URL(PROVIDER_URL);
  url.searchParams.set("lat", String(lat));
  url.searchParams.set("lon", String(lng));
  url.searchParams.set("format", "jsonv2");
  // City-level detail only; higher zoom would return streets and house numbers.
  url.searchParams.set("zoom", "10");
  url.searchParams.set("addressdetails", "1");

  const apiKey = readEnv("GEOCODE_API_KEY");
  if (apiKey) url.searchParams.set("key", apiKey);

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": `ourTailTales (${SITE_URL})`,
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(6000),
    });
    if (!response.ok) return null;

    const data = (await response.json()) as {
      address?: Record<string, string>;
    };
    const address = data.address ?? {};

    const city =
      address.city ??
      address.town ??
      address.village ??
      address.municipality ??
      address.county;

    const place = {
      city: city || undefined,
      region: address.state ?? address.region ?? undefined,
      country: address.country ?? undefined,
    };

    return place.city || place.region || place.country ? place : null;
  } catch {
    // A failed lookup is fine: the chapter falls back to dates alone.
    return null;
  }
}
