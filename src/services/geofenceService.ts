/**
 * Client-side geofence detection for heritage zones.
 *
 * Uses Haversine distance to check whether the user is inside any
 * configured heritage zone. No native geofencing library needed —
 * called on each GPS position update from the Lens screen.
 */

import type { HeritageZone } from '../core/config/geofence.types';
import { getCachedZones } from './zoneService';

/**
 * Max meters of reported GPS accuracy we add to a zone's radius before deciding
 * the user is inside. Real indoor/urban fixes drift 30–80m, so a hard
 * `dist <= radius` test locks legitimate visitors out. The cap stops a wildly
 * inaccurate fix (hundreds of metres) from making everywhere read as "inside".
 */
export const ACCURACY_SLACK_CAP_M = 150;

/**
 * Haversine distance in meters between two lat/lon points.
 */
function haversineMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6_371_000; // Earth radius in meters
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Returns the heritage zone the user is currently inside, or `null`.
 * If the user is inside multiple overlapping zones, the closest is returned.
 */
/** Last emitted `[geofence]` line, so an unchanged decision is not re-logged. */
let lastGeofenceLine = '';

export function getActiveZone(
  lat: number,
  lon: number,
  accuracyMeters = 0,
): HeritageZone | null {
  // Widen each zone's radius by the fix's reported accuracy (capped). A fix that
  // is 50m-accurate near the edge of a venue should still count as inside.
  const slack = Math.min(Math.max(accuracyMeters, 0), ACCURACY_SLACK_CAP_M);

  let best: HeritageZone | null = null;
  let bestDist = Infinity;
  let nearest: HeritageZone | null = null;
  let nearestDist = Infinity;

  for (const zone of getCachedZones()) {
    const dist = haversineMeters(lat, lon, zone.lat, zone.lon);
    if (dist < nearestDist) {
      nearest = zone;
      nearestDist = dist;
    }
    if (dist <= zone.radiusMeters + slack && dist < bestDist) {
      best = zone;
      bestDist = dist;
    }
  }

  // One-line field decision log (plain console.log so it surfaces in
  // `adb logcat` even on release builds during an on-site test).
  //
  // Deduplicated: the geofence is now re-evaluated whenever the zone list lands
  // as well as on every GPS tick, so a single fix produced the same line six or
  // seven times and buried the transition you actually came to read. Only a
  // CHANGED decision is logged — which is what matters on site.
  const chosen = best ?? nearest;
  const line = chosen
    ? `[geofence] lat=${lat.toFixed(5)} lon=${lon.toFixed(5)} acc=${Math.round(
        accuracyMeters,
      )}m venue=${chosen.monument_id} dist=${Math.round(
        best ? bestDist : nearestDist,
      )}m radius=${chosen.radiusMeters}m slack=${Math.round(
        slack,
      )}m inside=${best != null}`
    : `[geofence] lat=${lat.toFixed(5)} lon=${lon.toFixed(5)} acc=${Math.round(
        accuracyMeters,
      )}m no zones loaded`;
  if (line !== lastGeofenceLine) {
    lastGeofenceLine = line;
    console.log(line);
  }

  return best;
}

/**
 * Returns the nearest heritage zone and the distance to it, or `null`
 * if no zones are configured.
 */
export function getNearestZone(
  lat: number,
  lon: number,
): { zone: HeritageZone; distance: number } | null {
  const zones = getCachedZones();
  if (zones.length === 0) {
    return null;
  }

  let nearest = zones[0];
  let minDist = haversineMeters(lat, lon, nearest.lat, nearest.lon);

  for (let i = 1; i < zones.length; i++) {
    const zone = zones[i];
    const dist = haversineMeters(lat, lon, zone.lat, zone.lon);
    if (dist < minDist) {
      nearest = zone;
      minDist = dist;
    }
  }

  return { zone: nearest, distance: minDist };
}
