/**
 * Heritage site geofence zone type definitions.
 *
 * Zones are fetched dynamically from the backend API at `/api/v1/zones/`.
 * No hardcoded zones — the app relies entirely on the API response.
 */

export interface HeritageZone {
  id: string;
  name: string;
  /**
   * Stable slug used as the join key against monument_objects /
   * monument_anchors / ar_reconstruction_cache. Required for AR catalog
   * prefetch on zone entry.
   */
  monument_id: string;
  lat: number;
  lon: number;
  radiusMeters: number;
  /** Display label for the historical era, e.g. "13th Century" */
  epochLabel: string;
}
