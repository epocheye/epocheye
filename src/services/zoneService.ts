/**
 * Dynamic heritage zone fetching from the backend API.
 *
 * On success, caches the server response in memory so `getCachedZones()`
 * returns the latest data without another network call. On failure,
 * falls back to an empty list if the API is unreachable.
 */

import { createAuthenticatedClient } from '../utils/api/auth';
import type { HeritageZone } from '../core/config/geofence.types';

interface RawZone {
  id: string;
  name: string;
  monument_id?: string;
  lat: number;
  lon: number;
  radius_meters?: number;
  radiusMeters?: number;
  epoch_label?: string;
  epochLabel?: string;
}

let cachedZones: HeritageZone[] | null = null;

function normalizeZone(raw: RawZone): HeritageZone {
  return {
    id: raw.id,
    name: raw.name,
    monument_id: raw.monument_id ?? slugify(raw.name),
    lat: raw.lat,
    lon: raw.lon,
    radiusMeters: raw.radius_meters ?? raw.radiusMeters ?? 500,
    epochLabel: raw.epoch_label ?? raw.epochLabel ?? '',
  };
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

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

    const resp = await client.get<{ zones: RawZone[] }>(
      '/api/v1/zones/',
      { params, timeout: 10000 },
    );

    if (resp.data.zones && resp.data.zones.length > 0) {
      cachedZones = resp.data.zones.map(normalizeZone);
      return cachedZones;
    }
  } catch {
    // Silent — fall back to hardcoded config
  }

  return [];
}

/**
 * Returns the last-fetched zones, or the hardcoded fallback if
 * fetchZones() hasn't succeeded yet.
 */
export function getCachedZones(): HeritageZone[] {
  return cachedZones ?? [];
}
