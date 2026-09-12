import { kmBetween } from "@/lib/photo/cluster";

export type GeoPoint = { lat: number; lng: number };

/**
 * Decimal places kept before a coordinate leaves the browser. Two places is
 * roughly a 1 km grid: enough to name a city, far too coarse to identify a
 * home address.
 */
export const CENTROID_PRECISION = 2;

/** Photos within this distance belong to the same place. */
const CLUSTER_RADIUS_KM = 25;

export function reducePrecision(point: GeoPoint): GeoPoint {
  const factor = 10 ** CENTROID_PRECISION;
  return {
    lat: Math.round(point.lat * factor) / factor,
    lng: Math.round(point.lng * factor) / factor,
  };
}

/**
 * Groups coordinates into a few place clusters and returns their centroids at
 * reduced precision. Only these centroids are ever geocoded — never individual
 * photo coordinates.
 */
export function clusterCentroids(
  points: GeoPoint[],
  maxClusters = 3,
): { centroid: GeoPoint; count: number }[] {
  const clusters: { points: GeoPoint[]; centroid: GeoPoint }[] = [];

  for (const point of points) {
    const match = clusters.find(
      (cluster) => kmBetween(cluster.centroid, point) <= CLUSTER_RADIUS_KM,
    );
    if (match) {
      match.points.push(point);
      match.centroid = meanPoint(match.points);
    } else {
      clusters.push({ points: [point], centroid: point });
    }
  }

  return clusters
    .sort((a, b) => b.points.length - a.points.length)
    .slice(0, maxClusters)
    .map((cluster) => ({
      centroid: reducePrecision(cluster.centroid),
      count: cluster.points.length,
    }));
}

function meanPoint(points: GeoPoint[]): GeoPoint {
  const total = points.reduce(
    (sum, point) => ({ lat: sum.lat + point.lat, lng: sum.lng + point.lng }),
    { lat: 0, lng: 0 },
  );
  return { lat: total.lat / points.length, lng: total.lng / points.length };
}

/** Season and time-of-day patterns, described without inventing events. */
export function describeSeasons(timestamps: number[]): string[] {
  if (timestamps.length === 0) return [];

  const seasons = new Map<string, number>();
  for (const time of timestamps) {
    const month = new Date(time).getMonth();
    const season =
      month <= 1 || month === 11
        ? "winter"
        : month <= 4
          ? "spring"
          : month <= 7
            ? "summer"
            : "autumn";
    seasons.set(season, (seasons.get(season) ?? 0) + 1);
  }

  return [...seasons.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([season, count]) =>
      `${season} (${Math.round((count / timestamps.length) * 100)}% of photos)`,
    );
}
