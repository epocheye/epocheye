/**
 * Dynamic heritage zone fetching from the backend API.
 *
 * On success, caches the server response in memory so `getCachedZones()`
 * returns the latest data without another network call. On failure,
 * falls back silently to the hardcoded zones in geofence.config.ts.
 */

import { createAuthenticatedClient } from '../utils/api/auth';
import {
  HERITAGE_ZONES,
  type HeritageZone,
} from '../core/config/geofence.config';

let cachedZones: HeritageZone[] | null = null;

/**
 * Fetch zones from the backend. Caches the result in memory.
 * Falls back to hardcoded config on any error.
 */
export async function fetchZones(
  lat?: number,
  lon?: number,
): Promise<HeritageZone[]> {
  try {
    const client = createAuthenticatedClient();
    const params: Record<string, number> = {};
    if (lat != null && lon != null) {
      params.lat = lat;
      params.lon = lon;
    }

    const resp = await client.get<{ zones: HeritageZone[] }>(
      '/api/v1/zones/',
      { params, timeout: 10000 },
    );

    if (resp.data.zones && resp.data.zones.length > 0) {
      cachedZones = resp.data.zones;
      return cachedZones;
    }
  } catch {
    // Silent — fall back to hardcoded config
  }

  return HERITAGE_ZONES;
}

/**
 * Returns the last-fetched zones, or the hardcoded fallback if
 * fetchZones() hasn't succeeded yet.
 */
export function getCachedZones(): HeritageZone[] {
  return cachedZones ?? HERITAGE_ZONES;
}
