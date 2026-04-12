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
export function getActiveZone(
  lat: number,
  lon: number,
): HeritageZone | null {
  let best: HeritageZone | null = null;
  let bestDist = Infinity;

  for (const zone of getCachedZones()) {
    const dist = haversineMeters(lat, lon, zone.lat, zone.lon);
    if (dist <= zone.radiusMeters && dist < bestDist) {
      best = zone;
      bestDist = dist;
    }
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
