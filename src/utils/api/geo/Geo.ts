/**
 * Geo API Module
 *
 * Reverse-geocodes the device location to a city/locality for the Home header.
 * The Geoapify key lives server-side; this just calls our backend proxy.
 * Backend: E:\epocheye_backend\apis\geo\geo.go (GET /api/v1/geo/reverse)
 */

import { createAuthenticatedClient } from '../auth/Login';
import { createErrorResult } from '../helpers';

export interface ReverseGeocode {
  city: string;
  locality: string;
  state: string;
  country: string;
}

export type ReverseGeocodeResult =
  | { success: true; data: ReverseGeocode }
  | { success: false; error: { message: string } };

// Session cache keyed by coarse coordinate (~110 m buckets) so panning/jitter
// doesn't re-hit the network — mirrors the backend's own coarse cache.
const sessionCache = new Map<string, ReverseGeocode>();

function coarseKey(lat: number, lon: number): string {
  return `${(Math.round(lat * 1000) / 1000).toFixed(3)},${(
    Math.round(lon * 1000) / 1000
  ).toFixed(3)}`;
}

/** Best label for a header line: city, else locality, else empty. */
export function reverseGeocodeLabel(g: ReverseGeocode | null): string {
  if (!g) return '';
  if (g.city && g.country) return `${g.city}, ${g.country}`;
  return g.city || g.locality || '';
}

export interface IpLocation {
  country_iso: string;
  country: string;
  lat: number;
  lon: number;
}

/**
 * Coarse IP→country location, used as a last resort when the device can't
 * produce a GPS/network fix. Returns null when the lookup is unavailable or
 * carries no usable coordinate. Backend: GET /api/v1/geo/ip.
 */
export async function ipLocate(): Promise<IpLocation | null> {
  try {
    const client = await createAuthenticatedClient();
    const response = await client.get<IpLocation>('/api/v1/geo/ip');
    const d = response.data;
    if (
      d &&
      typeof d.lat === 'number' &&
      typeof d.lon === 'number' &&
      (d.lat !== 0 || d.lon !== 0)
    ) {
      return d;
    }
    return null;
  } catch {
    return null;
  }
}

export async function reverseGeocode(
  lat: number,
  lon: number,
): Promise<ReverseGeocodeResult> {
  const key = coarseKey(lat, lon);
  const cached = sessionCache.get(key);
  if (cached) return { success: true, data: cached };

  try {
    const client = await createAuthenticatedClient();
    const response = await client.get<ReverseGeocode>('/api/v1/geo/reverse', {
      params: { lat, lon },
    });
    const data: ReverseGeocode = {
      city: response.data?.city ?? '',
      locality: response.data?.locality ?? '',
      state: response.data?.state ?? '',
      country: response.data?.country ?? '',
    };
    // Only cache a meaningful hit so a transient empty doesn't pin the session.
    if (data.city || data.locality) sessionCache.set(key, data);
    return { success: true, data };
  } catch (error) {
    return createErrorResult(error);
  }
}
