/**
 * Heritage site geofence zone type definitions.
 *
 * Zones are fetched dynamically from the backend API at `/api/v1/zones/`.
 * No hardcoded zones — the app relies entirely on the API response.
 */

export interface HeritageZone {
  id: string;
  name: string;
  lat: number;
  lon: number;
  radiusMeters: number;
  /** Display label for the historical era, e.g. "13th Century" */
  epochLabel: string;
}
