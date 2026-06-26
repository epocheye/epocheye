/**
 * Heritage zones, derived from the curated sites list.
 *
 * The app's single source of curated venues is GET /api/v1/sites (monuments with
 * status active/published) — the same list the map pins, Home, and Passport use.
 * We map each curated site that has coordinates into a HeritageZone, so geofencing,
 * the away-from-venue screen, and venue search all reflect exactly those venues
 * (and nothing else). The older /api/v1/zones table is no longer read here — it
 * had drifted from the curated set and surfaced stale, non-curated venues.
 *
 * On success, caches the result in memory so getCachedZones() returns the latest
 * without another network call. On a network failure, returns an empty list and
 * flags lastFailed so the UI can tell a blip apart from genuinely being outside.
 */

import { createAuthenticatedClient } from '../utils/api/auth';
import type { HeritageZone } from '../core/config/geofence.types';
import type { SiteDetail } from '../utils/api/places/types';

let cachedZones: HeritageZone[] | null = null;
// Distinguish "venues fetched successfully" from "fetch failed (network)" so the
// UI can tell a network blip apart from genuinely being outside all venues.
let everLoaded = false;
let lastFailed = false;

/**
 * Client-side floor for a venue's radius so the app/Lens stays usable within ~1 km
 * of any site (GPS slack in geofenceService is added on top). Curated sites carry
 * no per-venue radius, so every derived zone uses this.
 */
const MIN_VENUE_RADIUS_M = 1000;

/**
 * Map a curated site to a geofence zone. Returns null for sites without
 * coordinates — they can't be geofenced or distance-sorted.
 */
function siteToZone(site: SiteDetail): HeritageZone | null {
  if (site.latitude == null || site.longitude == null) {
    return null;
  }
  // monument_id is the slug join key (monument_objects / anchors / AR catalog).
  const key =
    site.slug && site.slug.trim().length > 0 ? site.slug.trim() : site.id;
  return {
    id: key,
    name: site.name,
    monument_id: key,
    lat: site.latitude,
    lon: site.longitude,
    radiusMeters: MIN_VENUE_RADIUS_M,
    epochLabel: site.era ?? site.century ?? '',
  };
}

/**
 * Fetch the curated venues and cache them as heritage zones. The lat/lon args are
 * accepted for call-site compatibility but unused — the curated list is small and
 * nearest/within-range is computed client-side (see geofenceService).
 */
export async function fetchZones(
  _lat?: number,
  _lon?: number,
): Promise<HeritageZone[]> {
  try {
    const client = createAuthenticatedClient();
    const resp = await client.get<{ sites?: SiteDetail[] }>('/api/v1/sites', {
      timeout: 10000,
    });

    // Request reached the server (any 2xx) — not a network failure, even if it
    // returned zero sites (genuinely no curated venues yet).
    lastFailed = false;
    const zones = (Array.isArray(resp.data?.sites) ? resp.data.sites : [])
      .map(siteToZone)
      .filter((z): z is HeritageZone => z !== null);
    if (zones.length > 0) {
      cachedZones = zones;
      everLoaded = true;
      return zones;
    }
  } catch {
    // Network/transport failure — flag it so the UI doesn't read this as "outside".
    lastFailed = true;
  }

  return [];
}

/** Returns the last-fetched curated zones (empty until a fetch succeeds). */
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
