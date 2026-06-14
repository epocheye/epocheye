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
// Distinguish "zones fetched successfully" from "fetch failed (network)" so the
// UI can tell a network blip apart from genuinely being outside all venues.
let everLoaded = false;
let lastFailed = false;

/**
 * Client-side floor for a venue's radius. Backend-seeded radii (200–500m) are
 * too tight once normal GPS drift is added; this guarantees a generous minimum
 * (museum footprint + buffer) regardless of the stored value.
 */
const MIN_VENUE_RADIUS_M = 300;

function normalizeZone(raw: RawZone): HeritageZone {
  return {
    id: raw.id,
    name: raw.name,
    monument_id: raw.monument_id ?? slugify(raw.name),
    lat: raw.lat,
    lon: raw.lon,
    radiusMeters: Math.max(
      raw.radius_meters ?? raw.radiusMeters ?? 500,
      MIN_VENUE_RADIUS_M,
    ),
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

    // Request reached the server (any 2xx) — not a network failure, even if it
    // returned zero zones (genuinely no venues near the user).
    lastFailed = false;
    if (resp.data.zones && resp.data.zones.length > 0) {
      cachedZones = resp.data.zones.map(normalizeZone);
      everLoaded = true;
      return cachedZones;
    }
  } catch {
    // Network/transport failure — flag it so the UI doesn't read this as "outside".
    lastFailed = true;
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

/**
 * Fetch state, so callers can tell "couldn't check (network failure)" apart
 * from "checked, and you're genuinely outside all venues".
 */
export function getZonesStatus(): {
  everLoaded: boolean;
  lastFailed: boolean;
  count: number;
} {
  return { everLoaded, lastFailed, count: cachedZones?.length ?? 0 };
}
